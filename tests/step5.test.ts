import { describe, expect, it } from "vitest";
import { diffVersions, assumptionInputSchema, type AssumptionInput } from "@/lib/assumptions";
import { runSimulation } from "@/lib/engine";
import { allocationRows, weightedReturn } from "@/lib/portfolio";
import { contributionAllocation, inssBenefitFor, planToInput } from "@/lib/plan";
import { toDbMoney } from "@/lib/money";
import { defaultDemo } from "./plan-fixture";

describe("carteira: alocação e retorno ponderado", () => {
  const plan = defaultDemo(); // 400k IPCA+ (5% contratado), 250k ações
  it("alocação atual soma 100% e ignora contas fora da aposentadoria", () => {
    const rows = allocationRows({ ...plan, accounts: [...plan.accounts, { name: "Reserva", classId: "pos-fixado", balance: 100_000, costBasis: 100_000, included: false }] });
    expect(rows.reduce((s, r) => s + r.current, 0)).toBeCloseTo(1, 10);
    expect(rows.find((r) => r.classId === "pos-fixado")!.current).toBe(0);
    expect(rows.find((r) => r.classId === "ipca-mais")!.current).toBeCloseTo(400 / 650, 10);
  });
  it("retorno ponderado: taxa contratada vale em todos os cenários", () => {
    const w = 400 / 650;
    expect(weightedReturn(plan, "pessimista")).toBeCloseTo(w * 0.05 + (1 - w) * 0.03, 10);
    expect(weightedReturn(plan, "base")).toBeCloseTo(w * 0.05 + (1 - w) * 0.055, 10);
    expect(weightedReturn(plan, "otimista")).toBeCloseTo(w * 0.05 + (1 - w) * 0.07, 10);
  });
  it("alocação alvo vale quando soma 1; senão cai para a proporção da carteira", () => {
    expect(contributionAllocation({ ...plan, targetAllocation: { "acoes-br": 1 } })).toEqual({ "acoes-br": 1 });
    const fallback = contributionAllocation({ ...plan, targetAllocation: { "acoes-br": 0.4 } });
    expect(fallback["ipca-mais"]).toBeCloseTo(400 / 650, 10);
  });
  it("aportar na classe de maior retorno projeta mais patrimônio", () => {
    const a = runSimulation(planToInput({ ...plan, targetAllocation: { "pos-fixado": 1 } }, 65), { solve: false });
    const b = runSimulation(planToInput({ ...plan, targetAllocation: { "acoes-br": 1 } }, 65), { solve: false });
    expect(b.patrimonioProjetado).toBeGreaterThan(a.patrimonioProjetado);
  });
});

describe("plano → motor: extras, pausas, outras rendas e INSS", () => {
  const plan = defaultDemo();
  it("pausas e extras chegam ao motor", () => {
    const base = runSimulation(planToInput(plan, 65), { solve: false }).patrimonioProjetado;
    const paused = runSimulation(planToInput({ ...plan, pauses: [{ from: "2027-01", to: "2027-12", reason: null }] }, 65), { solve: false }).patrimonioProjetado;
    const extra = runSimulation(planToInput({ ...plan, extras: [{ description: "13º", amount: 10_000, month: 12, year: null, yearly: true }] }, 65), { solve: false }).patrimonioProjetado;
    expect(paused).toBeLessThan(base);
    expect(extra).toBeGreaterThan(base);
  });
  it("outra renda (aluguel) reduz o patrimônio necessário", () => {
    const base = runSimulation(planToInput(plan, 65), { solve: false }).patrimonioNecessario;
    const rent = runSimulation(
      planToInput({ ...plan, otherIncomes: [{ type: "aluguel", description: null, monthly: 2000, startAge: 60, endAge: null, realGrowth: 0, taxable: false }] }, 65),
      { solve: false },
    ).patrimonioNecessario;
    expect(rent).toBeLessThan(base);
  });
  it("cenário de aumento de contribuição eleva o benefício do INSS (limitado ao teto)", () => {
    const manual = inssBenefitFor(plan, 65);
    expect(manual).toBe(1621);
    const up = inssBenefitFor({ ...plan, inssIncrease: { enabled: true, newContributionSalary: 8475.55, from: "2027-01" } }, 65);
    expect(up).toBeGreaterThan(1621);
    expect(up).toBeLessThanOrEqual(8475.55);
    const off = inssBenefitFor({ ...plan, inssIncrease: { enabled: false, newContributionSalary: 8475.55, from: "2027-01" } }, 65);
    expect(off).toBe(1621);
  });
  it("aposentar antes encurta a janela de contribuição e reduz o benefício estimado", () => {
    const p = { ...plan, inssIncrease: { enabled: true, newContributionSalary: 8475.55, from: "2027-01" } };
    expect(inssBenefitFor(p, 60)).toBeLessThan(inssBenefitFor(p, 65));
  });
});

describe("premissas versionadas: diff", () => {
  const v1: AssumptionInput = {
    nome: "Base", inflation: 0.035, scenario: "base", method: "consumir_ate_horizonte", redemptionOrder: "proporcional",
    fixedWithdrawalRate: 0.04, minimumWage: 1621, ceiling: 8475.55, notes: null,
    classes: [
      { id: "a", name: "Ações", pessimista: 0.03, base: 0.055, otimista: 0.07, contracted: null, annualCost: 0 },
      { id: "b", name: "IPCA+", pessimista: 0.05, base: 0.05, otimista: 0.05, contracted: 0.05, annualCost: 0 },
    ],
  };
  it("sem mudanças → diff vazio", () => expect(diffVersions(v1, structuredClone(v1))).toEqual([]));
  it("lista só o que mudou, inclusive por classe", () => {
    const v2: AssumptionInput = {
      ...structuredClone(v1), inflation: 0.04, scenario: "pessimista", minimumWage: 1700,
      classes: [{ ...v1.classes[0]!, base: 0.05 }, v1.classes[1]!, { id: "c", name: "FIIs", pessimista: 0.03, base: 0.045, otimista: 0.06, contracted: null, annualCost: 0 }],
    };
    const keys = diffVersions(v1, v2).map((d) => d.key).sort();
    expect(keys).toEqual(["class:a:base", "class:c", "inflation", "minimumWage", "scenario"]);
    const infl = diffVersions(v1, v2).find((d) => d.key === "inflation")!;
    expect(infl.before).toMatch(/3,5/);
    expect(infl.after).toMatch(/4,0|4%/);
  });
  it("valida a entrada (inflação absurda é rejeitada)", () => {
    expect(assumptionInputSchema.safeParse({ ...v1, inflation: 5 }).success).toBe(false);
    expect(assumptionInputSchema.safeParse(v1).success).toBe(true);
  });
});

describe("fronteira monetária (decimal.js)", () => {
  it("arredonda para centavos sem erro de ponto flutuante", () => {
    expect(toDbMoney(0.1 + 0.2)).toBe("0.30");
    expect(toDbMoney(1234.565)).toBe("1234.56"); // meio-par
    expect(toDbMoney(1621)).toBe("1621.00");
  });
});
