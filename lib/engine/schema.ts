import { z } from "zod";

/** "AAAA-MM" */
export const ymSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM");

export const taxRegimeSchema = z.enum([
  "renda_fixa_regressivo",
  "acoes_15",
  "isento",
  "pgbl_regressivo",
  "vgbl_regressivo",
  "custom",
]);
export const withdrawalMethodSchema = z.enum(["preservar_capital", "consumir_ate_horizonte", "taxa_fixa"]);
export const redemptionOrderSchema = z.enum(["proporcional", "menor_ir_primeiro"]);
export const scenarioSchema = z.enum(["pessimista", "base", "otimista"]);
export const incomeTypeSchema = z.enum(["inss", "aluguel", "trabalho_parcial", "renda_mais", "outro"]);
export const expenseCategorySchema = z.enum(["essencial", "discricionario", "saude"]);

/** Taxas sempre como fração anual (0.035 = 3,5% a.a.). Dinheiro em reais de hoje. */
export const assetClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Retorno real anual do cenário escolhido (antes de `annualCost`). */
  realReturn: z.number().min(-0.99).max(1),
  annualCost: z.number().min(0).max(0.2).default(0),
  taxRegime: taxRegimeSchema,
  /** Substitui a alíquota padrão do regime (obrigatório de fato para `custom`). */
  taxRateOverride: z.number().min(0).max(0.5).optional(),
});

export const accountSchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  balance: z.number().min(0),
  costBasis: z.number().min(0),
  /** false = fora da aposentadoria (ex.: reserva de emergência). */
  included: z.boolean().default(true),
});

export const contributionPlanSchema = z.object({
  monthly: z.number().min(0),
  /** Reajuste real anual do aporte, aplicado a cada 12 meses desde `start`. */
  realGrowth: z.number().min(-0.5).max(1).default(0),
  start: ymSchema,
  end: ymSchema.nullable().default(null),
  /** classId → fração (soma 1). */
  allocation: z.record(z.string(), z.number().min(0)),
});

export const extraContributionSchema = z.object({
  amount: z.number().min(0),
  month: z.number().int().min(1).max(12),
  /** Ano específico (aporte único) ou omitido + yearly=true (recorrente). */
  year: z.number().int().optional(),
  yearly: z.boolean().default(false),
});

export const pauseSchema = z.object({ from: ymSchema, to: ymSchema });

export const incomeSourceSchema = z.object({
  type: incomeTypeSchema,
  /** Em reais de hoje. */
  monthly: z.number().min(0),
  startAge: z.number().min(0).max(120),
  endAge: z.number().min(0).max(120).nullable().default(null),
  realGrowth: z.number().min(-0.5).max(1).default(0),
  taxable: z.boolean().default(false),
});

export const expenseGoalSchema = z.object({
  category: expenseCategorySchema,
  monthly: z.number().min(0),
  startAge: z.number().min(0).max(120),
  endAge: z.number().min(0).max(120).nullable().default(null),
  /** Inflação acima do IPCA (saúde: 0.03). Cresce a partir de hoje. */
  extraInflation: z.number().min(-0.5).max(1).default(0),
  /** Degraus: a partir de `fromAge` multiplica o gasto por `factor` (ex.: 0.8 após 75). */
  ageSteps: z.array(z.object({ fromAge: z.number(), factor: z.number().min(0) })).default([]),
});

export const simulationInputSchema = z
  .object({
    /** Mês de partida da simulação ("AAAA-MM"). */
    startDate: ymSchema,
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    retirementAge: z.number().min(50).max(75),
    horizonAge: z.number().min(60).max(120).default(95),
    /** Só afeta valores nominais de exibição. */
    inflation: z.number().min(0).max(0.5).default(0.035),
    classes: z.array(assetClassSchema).min(1),
    accounts: z.array(accountSchema).default([]),
    contribution: contributionPlanSchema.nullable().default(null),
    extras: z.array(extraContributionSchema).default([]),
    pauses: z.array(pauseSchema).default([]),
    incomes: z.array(incomeSourceSchema).default([]),
    expenses: z.array(expenseGoalSchema).default([]),
    method: withdrawalMethodSchema.default("consumir_ate_horizonte"),
    /** Para `taxa_fixa`: fração anual do saldo. */
    fixedWithdrawalRate: z.number().min(0).max(0.5).default(0.04),
    redemptionOrder: redemptionOrderSchema.default("proporcional"),
    /** Alíquota efetiva sobre rendas externas marcadas como tributáveis. */
    externalIncomeTaxRate: z.number().min(0).max(0.5).default(0),
  })
  .superRefine((v, ctx) => {
    if (v.horizonAge <= v.retirementAge) {
      ctx.addIssue({ code: "custom", path: ["horizonAge"], message: "O horizonte deve ser maior que a idade de aposentadoria" });
    }
    const ids = new Set(v.classes.map((c) => c.id));
    v.accounts.forEach((a, i) => {
      if (!ids.has(a.classId)) ctx.addIssue({ code: "custom", path: ["accounts", i, "classId"], message: "Classe inexistente" });
    });
    if (v.contribution) {
      const entries = Object.entries(v.contribution.allocation);
      const sum = entries.reduce((s, [, w]) => s + w, 0);
      if (Math.abs(sum - 1) > 1e-6) {
        ctx.addIssue({ code: "custom", path: ["contribution", "allocation"], message: "A alocação deve somar 100%" });
      }
      for (const [id] of entries) {
        if (!ids.has(id)) ctx.addIssue({ code: "custom", path: ["contribution", "allocation", id], message: "Classe inexistente" });
      }
    }
  });

export type AssetClassInput = z.infer<typeof assetClassSchema>;
export type AccountInput = z.infer<typeof accountSchema>;
export type ContributionPlanInput = z.infer<typeof contributionPlanSchema>;
export type IncomeSourceInput = z.infer<typeof incomeSourceSchema>;
export type ExpenseGoalInput = z.infer<typeof expenseGoalSchema>;
export type SimulationInput = z.infer<typeof simulationInputSchema>;
export type SimulationInputDraft = z.input<typeof simulationInputSchema>;
export type WithdrawalMethod = z.infer<typeof withdrawalMethodSchema>;
export type TaxRegime = z.infer<typeof taxRegimeSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

export function parseSimulationInput(draft: SimulationInputDraft): SimulationInput {
  return simulationInputSchema.parse(draft);
}
