import { ageInMonths } from "./finance";
import { desiredNeedAt, externalIncomeAt, simulate, type MonthRow, type RunSummary } from "./simulate";
import { taxFraction } from "./tax";
import type { SimulationInput } from "./schema";

export interface ValuePair {
  real: number;
  nominal: number;
}

export interface AnnualRow {
  age: number;
  opening: ValuePair;
  contributions: ValuePair;
  returns: ValuePair;
  /** Saque bruto (inclui IR). */
  withdrawals: ValuePair;
  tax: ValuePair;
  externalIncome: ValuePair;
  closing: ValuePair;
}

export interface BridgeInfo {
  /** Idade em que o INSS começa. */
  inssStartAge: number;
  months: number;
  grossWithdrawn: number;
  netWithdrawn: number;
  /** Fração (0–1) do patrimônio da aposentadoria consumida antes do INSS começar. */
  shareOfPortfolio: number;
}

export interface SimulationResult {
  retirementAge: number;
  patrimonioProjetado: number;
  patrimonioNecessario: number;
  gap: number;
  aporteMensalNecessario: number | null;
  /** Maior renda mensal total (R$ de hoje, na idade de aposentadoria) que o plano sustenta. */
  rendaSustentavel: number | null;
  idadeEsgotamento: number | null;
  /** preservar_capital / taxa_fixa: a renda desejada coube em todos os meses? */
  rendaDesejadaCabe: boolean;
  ponte: BridgeInfo | null;
  serieMensal: MonthRow[];
  tabelaAnual: AnnualRow[];
}

const pair = (): ValuePair => ({ real: 0, nominal: 0 });

export function buildAnnualTable(rows: MonthRow[]): AnnualRow[] {
  const out = new Map<number, AnnualRow>();
  for (const r of rows) {
    const age = Math.floor(r.age + 1e-9);
    let a = out.get(age);
    if (!a) {
      a = {
        age,
        opening: { real: r.opening, nominal: r.opening * r.fStart },
        contributions: pair(), returns: pair(), withdrawals: pair(), tax: pair(), externalIncome: pair(), closing: pair(),
      };
      out.set(age, a);
    }
    const add = (p: ValuePair, v: number, f: number) => {
      p.real += v;
      p.nominal += v * f;
    };
    add(a.contributions, r.contributions, r.fStart);
    add(a.returns, r.returns, r.fStart);
    add(a.withdrawals, r.grossWithdrawal, r.fStart);
    add(a.tax, r.tax, r.fStart);
    add(a.externalIncome, r.externalIncome, r.fStart);
    a.closing = { real: r.closing, nominal: r.closing * r.fEnd };
  }
  return [...out.values()].sort((x, y) => x.age - y.age);
}

function retirementWeights(input: SimulationInput, run: RunSummary): number[] {
  const total = run.atRetirement.reduce((s, c) => s + c.balance, 0);
  if (total > 0) return run.atRetirement.map((c) => c.balance / total);
  const alloc = input.contribution?.allocation;
  const sum = alloc ? Object.values(alloc).reduce((s, w) => s + w, 0) : 0;
  if (alloc && sum > 0) return run.atRetirement.map((c) => (alloc[c.classId] ?? 0) / sum);
  return run.atRetirement.map((_, i) => (i === 0 ? 1 : 0));
}

/**
 * Patrimônio necessário na data de aposentadoria (R$ de hoje).
 * - consumir_ate_horizonte: valor presente dos saques brutos necessários até o horizonte,
 *   descontado pelo retorno real médio ponderado da carteira na retirada.
 * - preservar_capital: perpetuidade do maior saque bruto mensal necessário.
 * - taxa_fixa: maior necessidade anual bruta / taxa de retirada.
 * O IR usa a proporção ganho/saldo da carteira projetada na aposentadoria.
 */
export function requiredCapital(input: SimulationInput, run: RunSummary): number {
  const w = retirementWeights(input, run);
  let rbar = 0;
  let keep = 0;
  run.atRetirement.forEach((c, i) => {
    const cls = input.classes.find((k) => k.id === c.classId);
    const wi = w[i] ?? 0;
    if (!cls) return;
    const rm = Math.pow(1 + (cls.realReturn - cls.annualCost), 1 / 12) - 1;
    rbar += wi * rm;
    keep += wi * (1 - taxFraction(cls, c.balance, c.basis));
  });
  keep = Math.max(keep, 1e-9);

  const ageMonths0 = ageInMonths(input.birthDate, input.startDate);
  let pv = 0;
  let maxGross = 0;
  for (let m = run.retirementMonth; m < run.horizonMonths; m++) {
    const ageM = ageMonths0 + m;
    const netNeed = Math.max(0, desiredNeedAt(input, m, ageM) - externalIncomeAt(input, m, ageM).net);
    const gross = netNeed / keep;
    pv += gross / Math.pow(1 + rbar, m - run.retirementMonth);
    maxGross = Math.max(maxGross, gross);
  }
  if (input.method === "preservar_capital" && rbar > 0) return maxGross / rbar;
  if (input.method === "taxa_fixa" && input.fixedWithdrawalRate > 0) return (maxGross * 12) / input.fixedWithdrawalRate;
  return pv;
}

function withMonthlyContribution(input: SimulationInput, monthly: number): SimulationInput {
  if (input.contribution) return { ...input, contribution: { ...input.contribution, monthly } };
  const included = input.accounts.filter((a) => a.included);
  const total = included.reduce((s, a) => s + a.balance, 0);
  const allocation: Record<string, number> = {};
  for (const c of input.classes) allocation[c.id] = 0;
  if (total > 0) for (const a of included) allocation[a.classId] = (allocation[a.classId] ?? 0) + a.balance / total;
  else allocation[input.classes[0]!.id] = 1;
  return { ...input, contribution: { monthly, realGrowth: 0, start: input.startDate, end: null, allocation } };
}

function scaleExpenses(input: SimulationInput, k: number): SimulationInput {
  return { ...input, expenses: input.expenses.map((e) => ({ ...e, monthly: e.monthly * k })) };
}

function gapOf(input: SimulationInput): number {
  const run = simulate(input);
  return requiredCapital(input, run) - run.projectedAtRetirement;
}

/** Bisseção sobre o motor completo: aporte mensal que zera o gap (respeita pausas, extras e IR). */
export function solveMonthlyContribution(input: SimulationInput): number | null {
  if (gapOf(withMonthlyContribution(input, 0)) <= 0) return 0;
  let hi = 1000;
  while (gapOf(withMonthlyContribution(input, hi)) > 0) {
    hi *= 2;
    if (hi > 1e9) return null;
  }
  let lo = 0;
  for (let i = 0; i < 100 && hi - lo > 1e-6; i++) {
    const mid = (lo + hi) / 2;
    if (gapOf(withMonthlyContribution(input, mid)) > 0) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** O plano aguenta até o horizonte atendendo à renda desejada? */
export function isSustained(input: SimulationInput, run: RunSummary): boolean {
  return input.method === "consumir_ate_horizonte" ? run.exhaustionAge === null && run.unmetMonths === 0 : run.unmetMonths === 0;
}

/** Bisseção: maior fator `k` sobre os gastos desejados que o plano sustenta. */
export function solveSustainableIncome(input: SimulationInput): number | null {
  const ageMonths0 = ageInMonths(input.birthDate, input.startDate);
  const retM = Math.max(0, Math.round(input.retirementAge * 12) - ageMonths0);
  const baseNeed = desiredNeedAt(input, retM, ageMonths0 + retM);
  if (baseNeed <= 0) return null;
  const ok = (k: number) => isSustained(input, simulate(scaleExpenses(input, k)));
  let lo = 0;
  let hi = 1;
  while (ok(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1024) return lo * baseNeed;
  }
  for (let i = 0; i < 80 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo * baseNeed;
}

function bridgeInfo(input: SimulationInput, run: RunSummary): BridgeInfo | null {
  const inss = input.incomes.filter((i) => i.type === "inss" && i.monthly > 0);
  if (inss.length === 0) return null;
  const inssStartAge = Math.min(...inss.map((i) => i.startAge));
  if (input.retirementAge >= inssStartAge) return null;
  const rows = run.rows.filter((r) => r.phase === "retirada" && r.age < inssStartAge - 1e-9);
  const gross = rows.reduce((s, r) => s + r.grossWithdrawal, 0);
  const net = rows.reduce((s, r) => s + r.netWithdrawal, 0);
  return {
    inssStartAge,
    months: rows.length,
    grossWithdrawn: gross,
    netWithdrawn: net,
    shareOfPortfolio: run.projectedAtRetirement > 0 ? gross / run.projectedAtRetirement : 0,
  };
}

export interface RunOptions {
  /** Resolve aporte necessário e renda sustentável por bisseção (mais lento). Padrão: true. */
  solve?: boolean;
}

export function runSimulation(input: SimulationInput, opts: RunOptions = {}): SimulationResult {
  const run = simulate(input);
  const necessario = requiredCapital(input, run);
  const solve = opts.solve ?? true;
  return {
    retirementAge: input.retirementAge,
    patrimonioProjetado: run.projectedAtRetirement,
    patrimonioNecessario: necessario,
    gap: necessario - run.projectedAtRetirement,
    aporteMensalNecessario: solve ? solveMonthlyContribution(input) : null,
    rendaSustentavel: solve ? solveSustainableIncome(input) : null,
    idadeEsgotamento: run.exhaustionAge,
    rendaDesejadaCabe: run.unmetMonths === 0,
    ponte: bridgeInfo(input, run),
    serieMensal: run.rows,
    tabelaAnual: buildAnnualTable(run.rows),
  };
}

/** Roda a mesma entrada para várias idades de aposentadoria (ex.: 60 vs 65). */
export function compareRetirementAges(input: SimulationInput, ages: number[], opts?: RunOptions) {
  return ages.map((age) => runSimulation({ ...input, retirementAge: age }, opts));
}
