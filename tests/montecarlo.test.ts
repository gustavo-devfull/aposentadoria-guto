import { describe, expect, it } from "vitest";
import {
  cholesky, defaultCorrelation, drawReturns, mulberry32, normalSampler, runMonteCarlo, simulate, solveSustainableIncome,
  validateConfig, type MonteCarloConfig,
} from "@/lib/engine";
import { CLS_ZERO, make } from "./helpers";

const spend = (monthly: number) => ({ category: "essencial" as const, monthly, startAge: 0, endAge: null, extraInflation: 0, ageSteps: [] });
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

const base = make({
  retirementAge: 60,
  classes: [
    { ...CLS_ZERO, id: "rf", realReturn: 0.04 },
    { ...CLS_ZERO, id: "rv", name: "Ações", realReturn: 0.055 },
  ],
  accounts: [
    { id: "c1", classId: "rf", balance: 600_000, costBasis: 600_000 },
    { id: "c2", classId: "rv", balance: 400_000, costBasis: 400_000 },
  ],
  contribution: { monthly: 3000, realGrowth: 0, start: "2026-10", end: null, allocation: { rf: 0.5, rv: 0.5 } },
  expenses: [spend(1000)],
});
const cfg = (over: Partial<MonteCarloConfig> = {}): MonteCarloConfig => ({
  paths: 300, seed: 42, distribution: "lognormal", volatilities: [0.01, 0.22], correlation: defaultCorrelation([0.01, 0.22]), ...over,
});

describe("Monte Carlo — aleatoriedade", () => {
  it("mesma seed → mesma sequência; seeds diferentes → diferentes", () => {
    const a = mulberry32(7); const b = mulberry32(7); const c = mulberry32(8);
    const sa = Array.from({ length: 5 }, a); const sb = Array.from({ length: 5 }, b); const sc = Array.from({ length: 5 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it("normal padrão: média ≈ 0 e DP ≈ 1", () => {
    const n = normalSampler(mulberry32(1));
    const xs = Array.from({ length: 50_000 }, n);
    expect(Math.abs(mean(xs))).toBeLessThan(0.02);
    expect(Math.abs(sd(xs) - 1)).toBeLessThan(0.02);
  });
  it.each(["normal", "lognormal"] as const)("retornos %s preservam média e volatilidade", (dist) => {
    const n = normalSampler(mulberry32(3));
    const chol = cholesky([[1, 0], [0, 1]])!;
    const r = drawReturns([0.055, 0.04], [0.22, 0.01], chol, 40_000, dist, n);
    const eq = r.map((y) => y[0]!); const rf = r.map((y) => y[1]!);
    expect(Math.abs(mean(eq) - 0.055)).toBeLessThan(0.005);
    expect(Math.abs(sd(eq) - 0.22)).toBeLessThan(0.01);
    expect(Math.abs(mean(rf) - 0.04)).toBeLessThan(0.001);
    expect(Math.abs(sd(rf) - 0.01)).toBeLessThan(0.001);
  });
  it("correlação amostral ≈ matriz pedida", () => {
    const rho = 0.6;
    const chol = cholesky([[1, rho], [rho, 1]])!;
    const r = drawReturns([0.05, 0.05], [0.2, 0.2], chol, 40_000, "normal", normalSampler(mulberry32(9)));
    const a = r.map((y) => y[0]!); const b = r.map((y) => y[1]!);
    const ma = mean(a), mb = mean(b);
    const corr = mean(a.map((x, i) => (x - ma) * (b[i]! - mb))) / (sd(a) * sd(b));
    expect(Math.abs(corr - rho)).toBeLessThan(0.02);
  });
  it("Cholesky aceita matriz válida e rejeita inconsistente", () => {
    expect(cholesky(defaultCorrelation([0.01, 0.04, 0.22, 0.15, 0.18, 0.04]))).not.toBeNull();
    expect(cholesky([[1, 0.9, -0.9], [0.9, 1, 0.9], [-0.9, 0.9, 1]])).toBeNull();
  });
  it("validação da configuração", () => {
    expect(validateConfig(base, cfg())).toBeNull();
    expect(validateConfig(base, cfg({ paths: 6000 }))).toMatch(/5\.000/);
    expect(validateConfig(base, cfg({ volatilities: [0.1] }))).toMatch(/Volatilidade/);
    expect(validateConfig(base, cfg({ correlation: [[1, 0.5], [0.4, 1]] }))).toMatch(/simétrica/);
    expect(validateConfig(base, cfg({ correlation: [[1, 1.2], [1.2, 1]] }))).toMatch(/simétrica|−1 e 1/);
  });
});

describe("Monte Carlo — resultados", () => {
  it("reprodutível: mesma seed → resultado idêntico; seed diferente → diferente", () => {
    const a = runMonteCarlo(base, cfg()); const b = runMonteCarlo(base, cfg()); const c = runMonteCarlo(base, cfg({ seed: 43 }));
    expect(a).toEqual(b);
    expect(a.bands).not.toEqual(c.bands);
  });
  it("volatilidade zero reproduz exatamente o motor determinístico", () => {
    const det = simulate(base);
    const r = runMonteCarlo(base, cfg({ volatilities: [0, 0], paths: 20, correlation: [[1, 0], [0, 1]] }));
    r.points.forEach((p, k) => {
      const expected = det.rows[p.months - 1]!.closing;
      expect(r.bands[k]!.p10).toBeCloseTo(expected, 4);
      expect(r.bands[k]!.p50).toBeCloseTo(expected, 4);
      expect(r.bands[k]!.p90).toBeCloseTo(expected, 4);
    });
    expect(r.probSurvive).toBe(1);
  });
  it("percentis em ordem, probabilidades em [0,1] e pontos cobrem até o horizonte", () => {
    const r = runMonteCarlo(base, cfg());
    expect(r.bands.every((b) => b.p10 <= b.p50 + 1e-6 && b.p50 <= b.p90 + 1e-6)).toBe(true);
    expect(r.probSurvive).toBeGreaterThanOrEqual(0);
    expect(r.probSurvive).toBeLessThanOrEqual(1);
    expect(r.probIncomeFullyMet).toBeLessThanOrEqual(r.probSurvive + 1e-12);
    expect(r.points.at(-1)!.age).toBeCloseTo(95, 6);
    expect(r.bands.at(-1)!.p90).toBeGreaterThan(r.bands.at(-1)!.p10);
  });
  it("histograma de esgotamento soma as falhas e as idades estão entre aposentadoria e horizonte", () => {
    // gasto no limite do sustentável → parte das trajetórias esgota
    const k = solveSustainableIncome(base)!;
    const tight = { ...base, expenses: [spend(k * 0.95)] };
    const r = runMonteCarlo(tight, cfg({ paths: 500 }));
    expect(r.exhaustion.failures).toBeGreaterThan(0);
    expect(r.exhaustion.histogram.reduce((s, h) => s + h.count, 0)).toBe(r.exhaustion.failures);
    expect(r.exhaustion.histogram.every((h) => h.age >= 60 && h.age < 95)).toBe(true);
    expect(r.probSurvive).toBeCloseTo(1 - r.exhaustion.failures / 500, 12);
    expect(r.exhaustion.median).not.toBeNull();
  });
  it("mais volatilidade → menor probabilidade de o dinheiro durar (risco de sequência)", () => {
    const k = solveSustainableIncome(base)!;
    const tight = { ...base, expenses: [spend(k * 0.9)] };
    const calm = runMonteCarlo(tight, cfg({ paths: 600, volatilities: [0.01, 0.05] }));
    const wild = runMonteCarlo(tight, cfg({ paths: 600, volatilities: [0.01, 0.35] }));
    expect(wild.probSurvive).toBeLessThan(calm.probSurvive);
  });
  it("reporta progresso até 100%", () => {
    const seen: number[] = [];
    runMonteCarlo(base, cfg({ paths: 100 }), (d, t) => seen.push(d / t));
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
  it("5.000 trajetórias em tempo razoável", () => {
    const t0 = Date.now();
    runMonteCarlo(base, cfg({ paths: 5000 }));
    expect(Date.now() - t0).toBeLessThan(15_000);
  });
});
