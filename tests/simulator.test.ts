import { describe, expect, it } from "vitest";
import { ageOn, defaultPlan, MINIMUM_WAGE, planInputSchema, toSimpleInput } from "@/lib/plan";
import { annuityPayment, futureValue, inflationFactor, nominalContributions, realMonthlyRate, simulateRetirement, wealthByAge, type SimpleInput } from "@/lib/simulator";

const base: SimpleInput = {
  currentAge: 50, invested: 100_000, monthly: 2_000, annualRate: 0.12, inflation: 0.04,
  inssBenefit: 1621, inssStartAge: 65, horizonAge: 90,
};

describe("simulador simples", () => {
  it("taxa real desconta a inflação", () => {
    expect(Math.pow(1 + realMonthlyRate(0.12, 0.04), 12) - 1).toBeCloseTo(1.12 / 1.04 - 1, 10);
    expect(realMonthlyRate(0.04, 0.04)).toBeCloseTo(0, 12);
  });

  it("valor futuro: juros compostos + aportes no fim do mês", () => {
    expect(futureValue(1000, 0, 0.01, 12)).toBeCloseTo(1000 * 1.01 ** 12, 6);
    expect(futureValue(0, 100, 0, 10)).toBe(1000);
    expect(futureValue(0, 100, 0.01, 2)).toBeCloseTo(100 * 1.01 + 100, 6);
  });

  it("saque constante zera o patrimônio no prazo", () => {
    const r = 0.005, n = 240, pv = 500_000;
    const pmt = annuityPayment(pv, r, n);
    let b = pv;
    for (let i = 0; i < n; i++) b = (b - pmt) * (1 + r);
    expect(Math.abs(b)).toBeLessThan(1e-6);
    expect(annuityPayment(1200, 0, 12)).toBe(100);
  });

  it("aos 65 tem mais patrimônio e renda que aos 60; INSS é o salário mínimo", () => {
    const a60 = simulateRetirement(base, 60);
    const a65 = simulateRetirement(base, 65);
    expect(a60.months).toBe(120);
    expect(a65.patrimonio).toBeGreaterThan(a60.patrimonio);
    expect(a65.rendaConsumo).toBeGreaterThan(a60.rendaConsumo);
    expect(a60.rendaConsumo).toBeGreaterThan(a60.rendaJuros);
    expect(a60.inss).toBe(1621);
    expect(a60.totalAportado).toBe(240_000);
  });

  it("taxa igual à inflação: patrimônio = investido + aportes", () => {
    const r = simulateRetirement({ ...base, annualRate: 0.04 }, 60);
    expect(r.patrimonio).toBeCloseTo(100_000 + 240_000, 4);
    expect(r.rendaJuros).toBeCloseTo(0, 6);
  });

  it("gráfico acumula até a aposentadoria e zera no horizonte", () => {
    const pts = wealthByAge(base, [60, 65]);
    expect(pts[0]).toMatchObject({ age: 50, a60: 100_000, a65: 100_000 });
    const at = (age: number) => pts.find((p) => p.age === age)!;
    expect(at(60).a60).toBeCloseTo(simulateRetirement(base, 60).patrimonio, -1);
    expect(at(90).a60).toBeLessThan(1);
    expect(at(90).a65).toBeLessThan(1);
  });

});

describe("valores projetados (nominais)", () => {
  it("projetado = valor de hoje × (1 + inflação)^anos", () => {
    const r = simulateRetirement(base, 60); // 10 anos até a aposentadoria, 15 até o INSS
    const f10 = 1.04 ** 10, f15 = 1.04 ** 15;
    expect(r.anosAteAposentadoria).toBe(10);
    expect(r.anosAteInss).toBe(15);
    expect(r.projetado.patrimonio).toBeCloseTo(r.patrimonio * f10, 4);
    expect(r.projetado.rendaJuros).toBeCloseTo(r.rendaJuros * f10, 6);
    expect(r.projetado.rendaConsumo).toBeCloseTo(r.rendaConsumo * f10, 6);
    expect(r.projetado.inss).toBeCloseTo(1621 * f15, 6);
    expect(r.projetado.totalConsumo).toBeCloseTo((r.rendaConsumo + 1621) * f15, 6);
  });
  it("patrimônio projetado bate com a conta nominal direta (taxa nominal + aportes corrigidos)", () => {
    const g = 1.04 ** (1 / 12), rn = 1.12 ** (1 / 12) - 1;
    let b = base.invested;
    for (let k = 1; k <= 120; k++) b = b * (1 + rn) + base.monthly * g ** k;
    expect(simulateRetirement(base, 60).projetado.patrimonio).toBeCloseTo(b, 2);
  });
  it("aportes nominais somam a correção mês a mês; sem inflação, iguais ao de hoje", () => {
    expect(nominalContributions(100, 0, 12)).toBe(1200);
    const g = 1.04 ** (1 / 12);
    expect(nominalContributions(100, 0.04, 2)).toBeCloseTo(100 * g + 100 * g * g, 8);
    expect(inflationFactor(0.04, 0)).toBe(1);
  });
  it("gráfico projetado corrige cada ano pela inflação", () => {
    const real = wealthByAge(base, [60]);
    const nom = wealthByAge(base, [60], true);
    expect(nom[0]!.a60).toBe(real[0]!.a60);
    const i = real.findIndex((p) => p.age === 60);
    expect(nom[i]!.a60).toBeCloseTo(real[i]!.a60! * 1.04 ** 10, -2);
  });
});

describe("plano", () => {
  it("idade em anos completos", () => {
    const today = new Date("2026-10-15T12:00:00Z");
    expect(ageOn("1975-10-15", today)).toBe(51);
    expect(ageOn("1975-10-16", today)).toBe(50);
    expect(ageOn("1975-11-01", today)).toBe(50);
  });
  it("plano padrão é válido e tem INSS de um salário mínimo aos 65", () => {
    const p = defaultPlan();
    expect(planInputSchema.safeParse(p).success).toBe(true);
    expect(p.inssBenefit).toBe(MINIMUM_WAGE);
    expect(p.inssStartAge).toBe(65);
  });
  it("converte o plano em entrada do cálculo", () => {
    const i = toSimpleInput({ ...defaultPlan(), birthDate: "1975-10-15" }, new Date("2026-10-15T12:00:00Z"));
    expect(i.currentAge).toBe(51);
    expect(i).not.toHaveProperty("birthDate");
  });
  it("rejeita valores inválidos", () => {
    expect(planInputSchema.safeParse({ ...defaultPlan(), invested: -1 }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...defaultPlan(), birthDate: "15/10/1975" }).success).toBe(false);
  });
});
