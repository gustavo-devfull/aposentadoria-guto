import { describe, expect, it } from "vitest";
import {
  buildAnnualTable,
  estimateInssBenefit,
  nominalToRealRate,
  runSimulation,
  simulate,
  solveMonthlyContribution,
  solveSustainableIncome,
  toNominal,
  withdrawalTax,
  parseSimulationInput,
} from "@/lib/engine";
import { CLS_ZERO, make, plan } from "./helpers";

const inss = (monthly: number, startAge = 65) => ({ type: "inss" as const, monthly, startAge, endAge: null, realGrowth: 0, taxable: false });
const spend = (monthly: number, o: Record<string, unknown> = {}) => ({
  category: "essencial" as const, monthly, startAge: 0, endAge: null, extraInflation: 0, ageSteps: [], ...o,
});

describe("1. Retorno 0%, aporte R$ 1.000 por 120 meses", () => {
  it("acumula R$ 120.000", () => {
    const r = simulate(make({ retirementAge: 61, contribution: plan(1000) }));
    expect(r.projectedAtRetirement).toBeCloseTo(120_000, 2);
  });
});

describe("2. Juros compostos", () => {
  it("R$ 100.000 a 6% a.a. real por 10 anos → R$ 179.084,77", () => {
    const r = simulate(
      make({
        retirementAge: 61,
        classes: [{ ...CLS_ZERO, realReturn: 0.06 }],
        accounts: [{ id: "c1", classId: "a", balance: 100_000, costBasis: 100_000 }],
      }),
    );
    expect(Math.abs(r.projectedAtRetirement - 179_084.77)).toBeLessThanOrEqual(0.01);
  });
  it("subtrai o custo anual do retorno", () => {
    const r = simulate(
      make({
        classes: [{ ...CLS_ZERO, realReturn: 0.06, annualCost: 0.01 }],
        accounts: [{ id: "c1", classId: "a", balance: 100_000, costBasis: 100_000 }],
      }),
    );
    expect(r.projectedAtRetirement).toBeCloseTo(100_000 * Math.pow(1.05, 10), 2);
  });
});

describe("3. Conversão nominal → real", () => {
  it("10% nominal com inflação de 4% → 5,7692% real", () => {
    expect(nominalToRealRate(0.1, 0.04)).toBeCloseTo(0.057692, 6);
  });
  it("valor nominal = real × (1+inflação)^(meses/12)", () => {
    expect(toNominal(100, 24, 0.05)).toBeCloseTo(110.25, 8);
  });
});

describe("4. Consumir até o horizonte (anuidade)", () => {
  it.each(["isento", "renda_fixa_regressivo"] as const)("deixa saldo ≈ 0 (±R$ 1) no horizonte — %s", (regime) => {
    const input = make({
      retirementAge: 60,
      classes: [{ ...CLS_ZERO, realReturn: 0.04, taxRegime: regime }],
      accounts: [{ id: "c1", classId: "a", balance: 2_000_000, costBasis: 1_000_000 }],
      expenses: [spend(1000)],
      method: "consumir_ate_horizonte",
    });
    const income = solveSustainableIncome(input)!;
    const run = simulate({ ...input, expenses: [spend(income)] });
    expect(run.exhaustionAge).toBeNull();
    expect(run.finalBalance).toBeGreaterThanOrEqual(0);
    expect(run.finalBalance).toBeLessThanOrEqual(1);
  });
});

describe("5. Bisseção do aporte necessário", () => {
  it("reinserido no motor produz gap ≈ 0", () => {
    const input = make({
      retirementAge: 65,
      classes: [{ ...CLS_ZERO, realReturn: 0.04, taxRegime: "renda_fixa_regressivo" }],
      accounts: [{ id: "c1", classId: "a", balance: 300_000, costBasis: 250_000 }],
      contribution: plan(500),
      pauses: [{ from: "2028-01", to: "2028-12" }],
      extras: [{ amount: 10_000, month: 12, yearly: true }],
      incomes: [inss(1621)],
      expenses: [spend(7000)],
    });
    const c = solveMonthlyContribution(input)!;
    expect(c).toBeGreaterThan(0);
    const res = runSimulation({ ...input, contribution: { ...input.contribution!, monthly: c } }, { solve: false });
    expect(Math.abs(res.gap)).toBeLessThan(1);
  });
  it("retorna 0 quando já não há gap", () => {
    const input = make({
      retirementAge: 65,
      accounts: [{ id: "c1", classId: "a", balance: 5_000_000, costBasis: 5_000_000 }],
      expenses: [spend(1000)],
    });
    expect(solveMonthlyContribution(input)).toBe(0);
  });
});

describe("6. INSS só entra na idade configurada (ponte 60→65)", () => {
  const input = make({
    retirementAge: 60,
    classes: [{ ...CLS_ZERO, realReturn: 0.03 }],
    accounts: [{ id: "c1", classId: "a", balance: 1_500_000, costBasis: 1_000_000 }],
    incomes: [inss(1621)],
    expenses: [spend(8000)],
  });
  const res = runSimulation(input, { solve: false });
  it("60 meses de ponte sem renda do INSS", () => {
    const ret = res.serieMensal.filter((r) => r.phase === "retirada");
    const bridge = ret.filter((r) => r.age < 65);
    expect(bridge).toHaveLength(60);
    expect(bridge.every((r) => r.externalIncome === 0)).toBe(true);
    expect(ret.filter((r) => r.age >= 65).every((r) => Math.abs(r.externalIncome - 1621) < 1e-9)).toBe(true);
  });
  it("reporta total sacado e % do patrimônio consumido na ponte", () => {
    expect(res.ponte).not.toBeNull();
    expect(res.ponte!.months).toBe(60);
    expect(res.ponte!.inssStartAge).toBe(65);
    expect(res.ponte!.shareOfPortfolio).toBeGreaterThan(0.2);
    expect(res.ponte!.grossWithdrawn).toBeGreaterThan(8000 * 60 - 1);
  });
  it("aposentando aos 65 não há ponte", () => {
    expect(runSimulation({ ...input, retirementAge: 65 }, { solve: false }).ponte).toBeNull();
  });
});

describe("7. Saúde com +3% a.a. acima do IPCA", () => {
  it("cresce corretamente em termos reais", () => {
    const input = make({
      retirementAge: 51, // aposenta já: toda a série é retirada
      accounts: [{ id: "c1", classId: "a", balance: 5_000_000, costBasis: 5_000_000 }],
      expenses: [spend(1000, { category: "saude", extraInflation: 0.03 })],
    });
    const rows = simulate(input).rows;
    expect(rows[0]!.desiredNeed).toBeCloseTo(1000, 8);
    expect(rows[12]!.desiredNeed).toBeCloseTo(1030, 8);
    expect(rows[120]!.desiredNeed).toBeCloseTo(1000 * Math.pow(1.03, 10), 6);
  });
  it("degrau por idade reduz o gasto discricionário em 20% após 75", () => {
    const input = make({
      retirementAge: 51,
      accounts: [{ id: "c1", classId: "a", balance: 5_000_000, costBasis: 5_000_000 }],
      expenses: [spend(1000, { category: "discricionario", ageSteps: [{ fromAge: 75, factor: 0.8 }] })],
    });
    const rows = simulate(input).rows;
    expect(rows.find((r) => r.age < 75)!.desiredNeed).toBeCloseTo(1000, 8);
    expect(rows.find((r) => r.age >= 75)!.desiredNeed).toBeCloseTo(800, 8);
  });
});

describe("8. IR no resgate", () => {
  it("renda fixa com 50% de ganho e alíquota 15% → IR = 7,5% do resgate", () => {
    const cls = { taxRegime: "renda_fixa_regressivo" as const };
    expect(withdrawalTax(1000, cls, 200_000, 100_000)).toBeCloseTo(75, 8);
  });
  it("PGBL incide sobre o valor total resgatado", () => {
    expect(withdrawalTax(1000, { taxRegime: "pgbl_regressivo" }, 200_000, 200_000)).toBeCloseTo(100, 8);
  });
  it("no motor, o saque bruto entrega o líquido necessário", () => {
    const input = make({
      retirementAge: 51,
      classes: [{ ...CLS_ZERO, taxRegime: "renda_fixa_regressivo" }],
      accounts: [{ id: "c1", classId: "a", balance: 200_000, costBasis: 100_000 }],
      expenses: [spend(1000)],
    });
    const r = simulate(input).rows[0]!;
    expect(r.netWithdrawal).toBeCloseTo(1000, 6);
    expect(r.tax / r.grossWithdrawal).toBeCloseTo(0.075, 6);
  });
  it("resgatar primeiro a classe de menor IR", () => {
    const input = make({
      retirementAge: 51,
      redemptionOrder: "menor_ir_primeiro",
      classes: [
        { ...CLS_ZERO, id: "a", taxRegime: "renda_fixa_regressivo" },
        { ...CLS_ZERO, id: "b", name: "Isenta", taxRegime: "isento" },
      ],
      accounts: [
        { id: "c1", classId: "a", balance: 100_000, costBasis: 0 },
        { id: "c2", classId: "b", balance: 100_000, costBasis: 0 },
      ],
      expenses: [spend(1000)],
    });
    const r = simulate(input).rows[0]!;
    expect(r.tax).toBeCloseTo(0, 8);
    expect(r.grossWithdrawal).toBeCloseTo(1000, 8);
  });
});

describe("9. Pausas de aporte", () => {
  it("meses pausados não recebem aporte (nem extras)", () => {
    const r = simulate(
      make({
        retirementAge: 61,
        contribution: plan(1000),
        pauses: [{ from: "2027-01", to: "2027-12" }],
      }),
    );
    expect(r.rows.filter((x) => x.contributions === 0 && x.phase === "acumulacao")).toHaveLength(12);
    expect(r.projectedAtRetirement).toBeCloseTo(108_000, 2);
  });
  it("reajuste real anual e aporte extra anual", () => {
    const r = simulate(
      make({
        retirementAge: 53,
        contribution: plan(1000, { realGrowth: 0.1 }),
        extras: [{ amount: 500, month: 12, yearly: true }],
      }),
    );
    // 12×1000 + 12×1100 + extras (dez/2026, dez/2027) = 25.200 + 1.000
    expect(r.projectedAtRetirement).toBeCloseTo(26_200, 2);
  });
});

describe("10. Idade de esgotamento", () => {
  it("cenário insuficiente: R$ 100 mil, retorno 0, saque R$ 1.000/mês", () => {
    const r = simulate(
      make({
        retirementAge: 51,
        accounts: [{ id: "c1", classId: "a", balance: 100_000, costBasis: 100_000 }],
        expenses: [spend(1000)],
      }),
    );
    expect(r.exhaustionAge).toBeCloseTo(51 + 100 / 12, 6);
  });
  it("null quando o dinheiro dura", () => {
    const r = simulate(
      make({
        retirementAge: 51,
        accounts: [{ id: "c1", classId: "a", balance: 5_000_000, costBasis: 5_000_000 }],
        expenses: [spend(1000)],
      }),
    );
    expect(r.exhaustionAge).toBeNull();
  });
});

describe("Métodos de retirada, tabela anual e invariantes", () => {
  const base = {
    retirementAge: 60,
    classes: [{ ...CLS_ZERO, realReturn: 0.04 }],
    accounts: [{ id: "c1", classId: "a", balance: 1_000_000, costBasis: 1_000_000 }],
    expenses: [spend(5000)],
  };
  it("preservar capital: só saca até o retorno e informa se a renda cabe", () => {
    const cabe = runSimulation(make({ ...base, method: "preservar_capital", expenses: [spend(1500)] }), { solve: false });
    expect(cabe.rendaDesejadaCabe).toBe(true);
    const naoCabe = runSimulation(make({ ...base, method: "preservar_capital" }), { solve: false });
    expect(naoCabe.rendaDesejadaCabe).toBe(false);
    expect(naoCabe.idadeEsgotamento).toBeNull();
    const last = naoCabe.serieMensal.at(-1)!;
    expect(last.closing).toBeGreaterThanOrEqual(naoCabe.patrimonioProjetado - 1); // capital preservado
    expect(last.closing).toBeLessThanOrEqual(naoCabe.patrimonioProjetado + 1);
  });
  it("taxa fixa: saca X% a.a. do saldo, recalculado a cada ano", () => {
    const r = simulate(make({ ...base, method: "taxa_fixa", fixedWithdrawalRate: 0.04 }));
    const ret = r.rows.filter((x) => x.phase === "retirada");
    expect(ret[0]!.grossWithdrawal).toBeCloseTo((ret[0]!.opening * 0.04) / 12, 6);
    expect(ret[11]!.grossWithdrawal).toBeCloseTo(ret[0]!.grossWithdrawal, 8);
    expect(ret[12]!.grossWithdrawal).toBeCloseTo((ret[12]!.opening * 0.04) / 12, 6);
  });
  it("saldo final = saldo inicial + aportes + rendimentos − saques, mês a mês e por ano", () => {
    const input = make({ ...base, contribution: plan(2000), incomes: [inss(1621)], inflation: 0.04 });
    const res = runSimulation(input, { solve: false });
    for (const r of res.serieMensal) {
      expect(r.closing).toBeCloseTo(r.opening + r.contributions + r.returns - r.grossWithdrawal, 6);
    }
    for (const a of buildAnnualTable(res.serieMensal)) {
      expect(a.closing.real).toBeCloseTo(a.opening.real + a.contributions.real + a.returns.real - a.withdrawals.real, 4);
      expect(a.closing.nominal).toBeGreaterThanOrEqual(a.closing.real - 1e-6); // inflação > 0
    }
  });
  it("conta excluída da aposentadoria não entra", () => {
    const r = simulate(
      make({ accounts: [{ id: "c1", classId: "a", balance: 100_000, costBasis: 0, included: false }] }),
    );
    expect(r.projectedAtRetirement).toBe(0);
  });
  it("aposentar aos 65 exige menos aporte que aos 60 (mesmo plano)", () => {
    const input = make({ ...base, expenses: [spend(9000)], incomes: [inss(1621)], contribution: plan(1000) });
    const a60 = solveMonthlyContribution({ ...input, retirementAge: 60 })!;
    const a65 = solveMonthlyContribution({ ...input, retirementAge: 65 })!;
    expect(a60).toBeGreaterThan(0);
    expect(a65).toBeLessThan(a60);
  });
});

describe("Validação (Zod) e INSS", () => {
  it("rejeita alocação que não soma 100%", () => {
    expect(() => make({ contribution: plan(1000, { allocation: { a: 0.5 } }) })).toThrow();
  });
  it("rejeita horizonte ≤ idade de aposentadoria", () => {
    expect(() => parseSimulationInput({ ...make(), retirementAge: 70, horizonAge: 70 })).toThrow();
  });
  it("benefício estimado fica no piso (1 salário mínimo) com contribuição sobre o mínimo", () => {
    const e = estimateInssBenefit({
      contributionYearsSoFar: 23, historicalAverageSalary: 1621, currentContributionSalary: 1621,
      startDate: "2026-10", stopContributingAge: 65, ageAtStartYears: 51,
      minimumWage: 1621, ceiling: 8475.55,
    });
    expect(e.benefit).toBe(1621);
    expect(e.clampedBy).toBe("minimo");
  });
  it("aumentar a contribuição eleva o benefício, limitado ao teto", () => {
    const common = {
      contributionYearsSoFar: 23, historicalAverageSalary: 1621, currentContributionSalary: 1621,
      startDate: "2026-10", stopContributingAge: 65, ageAtStartYears: 51, minimumWage: 1621, ceiling: 8475.55,
    };
    const up = estimateInssBenefit({ ...common, increase: { newContributionSalary: 8475.55, from: "2027-01" } });
    expect(up.benefit).toBeGreaterThan(1621);
    expect(up.benefit).toBeLessThanOrEqual(8475.55);
    const earlyStop = estimateInssBenefit({ ...common, stopContributingAge: 60, increase: { newContributionSalary: 8475.55, from: "2027-01" } });
    expect(earlyStop.benefit).toBeLessThan(up.benefit);
    expect(up.warning).toMatch(/Meu INSS/);
  });
});
