import { simulate, ymIndex, type SimulationInput } from "@/lib/engine";

export interface SnapshotInput {
  year: number;
  month: number;
  /** accountId → saldo realizado (R$ nominais, fim do mês). */
  balances: Record<string, number>;
  contribution: number;
  note: string | null;
}

export interface TrackingRow {
  year: number;
  month: number;
  key: string;
  realized: number;
  projected: number;
  deviation: number;
  /** Fração (−0,12 = 12% abaixo do plano). */
  deviationPct: number;
  contributionRealizedCum: number;
  contributionProjectedCum: number;
  below: boolean;
  note: string | null;
}

export interface TrackingResult {
  rows: TrackingRow[];
  /** Série projetada (nominal) para o gráfico, por mês "AAAA-MM". */
  projectedSeries: { key: string; projected: number }[];
  /** Último desvio, para o alerta. */
  latest: TrackingRow | null;
  alert: boolean;
  threshold: number;
}

const keyOf = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;

/**
 * Compara os lançamentos reais com a trajetória da simulação de referência.
 * O plano é projetado em R$ de hoje; aqui é convertido para nominal (com a inflação da própria simulação)
 * para ser comparável aos saldos realmente observados.
 */
export function trackAgainstPlan(
  input: SimulationInput,
  snapshots: SnapshotInput[],
  opts: { includedAccountIds?: Set<string>; threshold?: number } = {},
): TrackingResult {
  const threshold = opts.threshold ?? 0.1;
  const run = simulate(input);
  const start = ymIndex(input.startDate);
  const byM = new Map(run.rows.map((r) => [r.m, r]));

  const sorted = [...snapshots].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  const rows: TrackingRow[] = [];
  let contribReal = 0;
  let contribProj = 0;
  let prevM: number | null = null;

  for (const s of sorted) {
    const idx = s.year * 12 + (s.month - 1);
    const m = idx - start;
    const row = byM.get(m);
    if (!row) continue; // fora da janela da simulação
    const realized = Object.entries(s.balances)
      .filter(([id]) => !opts.includedAccountIds || opts.includedAccountIds.has(id))
      .reduce((sum, [, v]) => sum + v, 0);
    const projected = row.closing * row.fEnd;

    // Aportes projetados somados desde o 1º lançamento (para ser comparável ao realizado acumulado).
    const from: number = prevM === null ? m : prevM + 1;
    for (let k = from; k <= m; k++) {
      const r = byM.get(k);
      if (r) contribProj += r.contributions * r.fStart;
    }
    contribReal += s.contribution;
    prevM = m;

    const deviation = realized - projected;
    const deviationPct = projected > 0 ? deviation / projected : 0;
    rows.push({
      year: s.year, month: s.month, key: keyOf(idx), realized, projected, deviation, deviationPct,
      contributionRealizedCum: contribReal, contributionProjectedCum: contribProj,
      below: deviationPct < -threshold, note: s.note,
    });
  }

  const projectedSeries = run.rows
    .filter((r) => r.phase === "acumulacao")
    .map((r) => ({ key: keyOf(start + r.m), projected: r.closing * r.fEnd }));
  const latest = rows.at(-1) ?? null;
  return { rows, projectedSeries, latest, alert: latest?.below ?? false, threshold };
}
