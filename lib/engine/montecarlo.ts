import { ageInMonths } from "./finance";
import type { SimulationInput } from "./schema";
import { netAnnualReturn, simulate } from "./simulate";

export type ReturnDistribution = "normal" | "lognormal";

export interface MonteCarloConfig {
  /** 1.000 a 5.000 trajetórias. */
  paths: number;
  /** Seed inteira: mesma seed + mesma entrada = mesmo resultado. */
  seed: number;
  distribution: ReturnDistribution;
  /** Volatilidade real anual por classe, na ordem de `input.classes`. */
  volatilities: number[];
  /** Matriz de correlação (simétrica, diagonal 1), na ordem de `input.classes`. */
  correlation: number[][];
}

export interface MonteCarloResult {
  paths: number;
  seed: number;
  retirementAge: number;
  horizonAge: number;
  /** P(o dinheiro durar até o horizonte): nenhuma trajetória esgota o saldo antes. */
  probSurvive: number;
  /** P(a renda desejada ser atendida em todos os meses) — mais rígida que durar. */
  probIncomeFullyMet: number;
  /** Idade (anos) no fim de cada ponto anual e meses desde o início (para converter p/ nominal). */
  points: { age: number; months: number }[];
  /** Patrimônio real (R$ de hoje) nos percentis 10/50/90 em cada ponto. */
  bands: { p10: number; p50: number; p90: number }[];
  exhaustion: {
    failures: number;
    /** Idade mediana de esgotamento entre as trajetórias que esgotaram (ou null). */
    median: number | null;
    /** Contagem por idade inteira de esgotamento. */
    histogram: { age: number; count: number }[];
  };
}

// ---------------------------------------------------------------------------
// Aleatoriedade reprodutível
// ---------------------------------------------------------------------------

/** mulberry32: PRNG de 32 bits, determinístico por seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal padrão por Box–Muller (consome dois uniformes por par; descarta o 2º para manter a ordem simples). */
export function normalSampler(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** Fatoração de Cholesky (L tal que L·Lᵀ = A). Retorna null se A não for positiva definida. */
export function cholesky(a: number[][]): number[][] | null {
  const n = a.length;
  const l = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = a[i]![j]!;
      for (let k = 0; k < j; k++) sum -= l[i]![k]! * l[j]![k]!;
      if (i === j) {
        if (sum <= 1e-12) return null;
        l[i]![j] = Math.sqrt(sum);
      } else {
        l[i]![j] = sum / l[j]![j]!;
      }
    }
  }
  return l;
}

/**
 * Correlação padrão simplificada, derivada da volatilidade: ativos de risco (vol ≥ 10%) entre si 0,5;
 * conservadores entre si 0,2; mistos 0,1. Editável pelo usuário.
 */
export function defaultCorrelation(volatilities: number[]): number[][] {
  const risky = volatilities.map((v) => v >= 0.1);
  return volatilities.map((_, i) =>
    volatilities.map((_, j) => (i === j ? 1 : risky[i] && risky[j] ? 0.5 : !risky[i] && !risky[j] ? 0.2 : 0.1)),
  );
}

export function validateConfig(input: SimulationInput, cfg: MonteCarloConfig): string | null {
  const n = input.classes.length;
  if (!Number.isInteger(cfg.paths) || cfg.paths < 1 || cfg.paths > 5000) return "Use de 1 a 5.000 trajetórias";
  if (cfg.volatilities.length !== n || cfg.volatilities.some((v) => !(v >= 0) || v > 1)) return "Volatilidade inválida";
  if (cfg.correlation.length !== n || cfg.correlation.some((r) => r.length !== n)) return "Matriz de correlação com dimensão errada";
  for (let i = 0; i < n; i++) {
    if (Math.abs(cfg.correlation[i]![i]! - 1) > 1e-9) return "A diagonal da correlação deve ser 1";
    for (let j = 0; j < i; j++) {
      const r = cfg.correlation[i]![j]!;
      if (Math.abs(r) > 1 || Math.abs(r - cfg.correlation[j]![i]!) > 1e-9) return "A matriz de correlação deve ser simétrica, com valores entre −1 e 1";
    }
  }
  if (cholesky(cfg.correlation) === null) return "A matriz de correlação não é consistente (não é positiva definida)";
  return null;
}

/**
 * Sorteia os retornos reais anuais líquidos (anos × classes) preservando média e volatilidade informadas.
 * - normal: r = m + σ·z (limitado a −95%).
 * - lognormal: 1+r lognormal com E[1+r] = 1+m e DP = σ.
 */
export function drawReturns(
  means: number[],
  vols: number[],
  chol: number[][],
  years: number,
  dist: ReturnDistribution,
  nextNormal: () => number,
): number[][] {
  const n = means.length;
  const ln = means.map((m, i) => {
    const s2 = Math.log(1 + (vols[i]! * vols[i]!) / ((1 + m) * (1 + m)));
    return { mu: Math.log(1 + m) - s2 / 2, sigma: Math.sqrt(s2) };
  });
  const out: number[][] = [];
  const z = new Array<number>(n);
  const c = new Array<number>(n);
  for (let y = 0; y < years; y++) {
    for (let i = 0; i < n; i++) z[i] = nextNormal();
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let k = 0; k <= i; k++) v += chol[i]![k]! * z[k]!;
      c[i] = v; // normal padrão com a correlação desejada
    }
    out.push(
      means.map((m, i) =>
        dist === "normal" ? Math.max(-0.95, m + vols[i]! * c[i]!) : Math.exp(ln[i]!.mu + ln[i]!.sigma * c[i]!) - 1,
      ),
    );
  }
  return out;
}

const percentile = (sorted: number[], p: number) => {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
};

/**
 * Monte Carlo: roda o MESMO motor determinístico com retornos aleatórios por trajetória.
 * `onProgress` é chamado a cada lote (para a barra de progresso no Web Worker).
 */
export function runMonteCarlo(
  input: SimulationInput,
  cfg: MonteCarloConfig,
  onProgress?: (done: number, total: number) => void,
): MonteCarloResult {
  const err = validateConfig(input, cfg);
  if (err) throw new Error(err);

  const chol = cholesky(cfg.correlation)!;
  const means = input.classes.map(netAnnualReturn);
  const rng = mulberry32(cfg.seed);
  const nextNormal = normalSampler(rng);

  const ageMonths0 = ageInMonths(input.birthDate, input.startDate);
  const horizonMonths = Math.round(input.horizonAge * 12) - ageMonths0;
  const years = Math.ceil(horizonMonths / 12);

  // Pontos anuais: fim de cada 12 meses (e o último mês do horizonte).
  const pointMonths: number[] = [];
  for (let m = 12; m < horizonMonths; m += 12) pointMonths.push(m);
  pointMonths.push(horizonMonths);

  const balances: number[][] = pointMonths.map(() => new Array<number>(cfg.paths));
  const exhaustionAges: number[] = [];
  let survive = 0;
  let fullyMet = 0;
  const batch = Math.max(1, Math.floor(cfg.paths / 20));

  for (let p = 0; p < cfg.paths; p++) {
    const annualReturns = drawReturns(means, cfg.volatilities, chol, years, cfg.distribution, nextNormal);
    const run = simulate(input, { annualReturns });
    pointMonths.forEach((m, k) => {
      balances[k]![p] = run.rows[m - 1]!.closing;
    });
    if (run.exhaustionAge === null) survive++;
    else exhaustionAges.push(run.exhaustionAge);
    if (run.unmetMonths === 0) fullyMet++;
    if (onProgress && ((p + 1) % batch === 0 || p + 1 === cfg.paths)) onProgress(p + 1, cfg.paths);
  }

  const bands = balances.map((col) => {
    const sorted = [...col].sort((a, b) => a - b);
    return { p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
  });

  const hist = new Map<number, number>();
  for (const a of exhaustionAges) hist.set(Math.floor(a), (hist.get(Math.floor(a)) ?? 0) + 1);
  const sortedAges = [...exhaustionAges].sort((a, b) => a - b);

  return {
    paths: cfg.paths,
    seed: cfg.seed,
    retirementAge: input.retirementAge,
    horizonAge: input.horizonAge,
    probSurvive: survive / cfg.paths,
    probIncomeFullyMet: fullyMet / cfg.paths,
    points: pointMonths.map((m) => ({ age: (ageMonths0 + m) / 12, months: m })),
    bands,
    exhaustion: {
      failures: exhaustionAges.length,
      median: sortedAges.length ? percentile(sortedAges, 0.5) : null,
      histogram: [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([age, count]) => ({ age, count })),
    },
  };
}
