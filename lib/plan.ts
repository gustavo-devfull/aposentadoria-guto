import { z } from "zod";
import type { SimpleInput } from "@/lib/simulator";

/** Salário mínimo 2026 — usado como benefício do INSS. Atualizar todo ano. */
export const MINIMUM_WAGE = 1621;
/** Inflação de longo prazo (Boletim Focus/BCB) — atualizar periodicamente. */
export const DEFAULT_INFLATION = 0.035;
export const RETIREMENT_AGES = [60, 65] as const;

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
  };
}

/** Idade em anos completos na data `today`. */
export function ageOn(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age--;
  return age;
}

export function toSimpleInput(plan: PlanInput, today: Date = new Date()): SimpleInput {
  const { birthDate, ...rest } = plan;
  return { ...rest, currentAge: ageOn(birthDate, today) };
}
