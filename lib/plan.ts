import { z } from "zod";
import type { LumpSum, SimpleInput } from "@/lib/simulator";

/** Salário mínimo 2026 — usado como benefício do INSS. Atualizar todo ano. */
export const MINIMUM_WAGE = 1621;
/** Inflação de longo prazo (Boletim Focus/BCB) — atualizar periodicamente. */
export const DEFAULT_INFLATION = 0.035;
export const RETIREMENT_AGES = [60, 65] as const;

/** Aporte pontual do plano: valor em R$ de hoje, no mês "AAAA-MM". */
export const lumpSumInputSchema = z.object({
  amount: z.number().min(0).max(1e12),
  date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM"),
});
export type LumpSumInput = z.infer<typeof lumpSumInputSchema>;

/** O plano do usuário: o que ele preenche no simulador. Taxas em fração (0.12 = 12% a.a.). */
export const planInputSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento"),
  invested: z.number().min(0).max(1e12),
  monthly: z.number().min(0).max(1e9),
  annualRate: z.number().min(-0.5).max(2),
  inflation: z.number().min(-0.1).max(1),
  inssBenefit: z.number().min(0).max(1e7),
  inssStartAge: z.number().int().min(50).max(100),
  horizonAge: z.number().int().min(61).max(120),
  /** Aportes pontuais (planos/cenários antigos, sem o campo, valem como lista vazia). */
  lumpSums: z.array(lumpSumInputSchema).max(50).default([]),
});
export type PlanInput = z.infer<typeof planInputSchema>;

export function defaultPlan(): PlanInput {
  return {
    birthDate: "1975-01-01",
    invested: 0,
    monthly: 0,
    annualRate: 0.12,
    inflation: DEFAULT_INFLATION,
    inssBenefit: MINIMUM_WAGE,
    inssStartAge: 65,
    horizonAge: 90,
    lumpSums: [],
  };
}

/** Idade em anos completos na data `today`. */
export function ageOn(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age--;
  return age;
}

/** Meses de `today` até "AAAA-MM" (0 = mês atual, 1 = mês que vem; negativo = passado). */
export function monthsFromToday(date: string, today: Date = new Date()): number {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return y * 12 + (m - 1) - (today.getUTCFullYear() * 12 + today.getUTCMonth());
}

/** Aportes pontuais já no formato do cálculo: descarta valor zero e meses que já passaram. */
export function toLumpSums(lumps: LumpSumInput[], today: Date = new Date()): LumpSum[] {
  return lumps.flatMap((l) => {
    const month = monthsFromToday(l.date, today);
    return l.amount > 0 && month >= 0 ? [{ amount: l.amount, month }] : [];
  });
}

export function toSimpleInput(plan: PlanInput, today: Date = new Date()): SimpleInput {
  const { birthDate, lumpSums, ...rest } = plan;
  return { ...rest, currentAge: ageOn(birthDate, today), lumpSums: toLumpSums(lumpSums ?? [], today) };
}

/** Em quais idades de aposentadoria o aporte pontual conta (as que terminam depois do mês dele). */
export function lumpSumCountsFor(date: string, currentAge: number, ages: readonly number[], today: Date = new Date()): number[] {
  const k = monthsFromToday(date, today);
  if (k < 0) return [];
  return ages.filter((age) => k <= Math.max(0, Math.round((age - currentAge) * 12)));
}
