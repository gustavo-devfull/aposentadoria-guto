import { z } from "zod";
import {
  ageInMonths,
  estimateInssBenefit,
  parseSimulationInput,
  resolveClasses,
  nominalFactor,
  scenarioSchema,
  withdrawalMethodSchema,
  redemptionOrderSchema,
  DEFAULT_ASSET_CLASSES,
  DEFAULT_INFLATION,
  DEFAULT_INSS_PARAMS,
  type AssetClassTemplate,
  type SimulationInput,
} from "@/lib/engine";

/** Valores monetários em R$ de hoje; taxas como fração. Fonte única para wizard, banco e dashboard. */
export const planFormSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento"),
  horizonAge: z.number().int().min(60).max(120),
  targetAges: z.array(z.number().int().min(50).max(75)).min(1).max(3),
  inss: z.object({
    contributionYears: z.number().min(0).max(60),
    contributionSalary: z.number().min(0),
    benefit: z.number().min(0),
    startAge: z.number().int().min(50).max(75),
    realGrowth: z.number().min(-0.5).max(1),
  }),
  accounts: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Dê um nome"),
      classId: z.string().min(1, "Escolha a classe"),
      institution: z.string().optional(),
      balance: z.number().min(0),
      costBasis: z.number().min(0),
      included: z.boolean(),
    }),
  ),
  contribution: z.object({ monthly: z.number().min(0), realGrowth: z.number().min(-0.5).max(1) }),
  expenses: z
    .array(
      z.object({
        category: z.enum(["essencial", "discricionario", "saude"]),
        monthly: z.number().min(0),
        startAge: z.number().min(0).max(120),
        endAge: z.number().min(0).max(120).nullable(),
        extraInflation: z.number().min(-0.5).max(1),
      }),
    )
    .min(1, "Informe ao menos uma meta de gasto"),
});
export type PlanForm = z.infer<typeof planFormSchema>;

export interface PlanData extends PlanForm {
  /** Mês atual "AAAA-MM". */
  startDate: string;
  scenario: z.infer<typeof scenarioSchema>;
  inflation: number;
  method: z.infer<typeof withdrawalMethodSchema>;
  redemptionOrder: z.infer<typeof redemptionOrderSchema>;
  classes: AssetClassTemplate[];
}

export const currentYm = () => new Date().toISOString().slice(0, 7);

/** Valores iniciais do onboarding (perfil do usuário; demais campos editáveis). */
export function defaultPlanForm(): PlanForm {
  return {
    birthDate: "1975-10-15",
    horizonAge: 95,
    targetAges: [60, 65],
    inss: {
      contributionYears: 23,
      contributionSalary: DEFAULT_INSS_PARAMS.minimumWage,
      benefit: DEFAULT_INSS_PARAMS.minimumWage,
      startAge: 65,
      realGrowth: 0,
    },
    accounts: [],
    contribution: { monthly: 0, realGrowth: 0 },
    expenses: [
      { category: "essencial", monthly: 6000, startAge: 60, endAge: null, extraInflation: 0 },
      { category: "saude", monthly: 1500, startAge: 60, endAge: null, extraInflation: 0.03 },
    ],
  };
}

export function withPlanDefaults(form: PlanForm, over: Partial<PlanData> = {}): PlanData {
  return {
    ...form,
    startDate: currentYm(),
    scenario: "base",
    inflation: DEFAULT_INFLATION,
    method: "consumir_ate_horizonte",
    redemptionOrder: "proporcional",
    classes: DEFAULT_ASSET_CLASSES,
    ...over,
  };
}

/** Monta o SimulationInput validado para uma idade de aposentadoria. */
export function planToInput(plan: PlanData, retirementAge: number): SimulationInput {
  const included = plan.accounts.filter((a) => a.included);
  const total = included.reduce((s, a) => s + a.balance, 0);
  const allocation: Record<string, number> = {};
  if (total > 0) for (const a of included) allocation[a.classId] = (allocation[a.classId] ?? 0) + a.balance / total;
  else if (plan.classes[0]) allocation[plan.classes[0].id] = 1;

  return parseSimulationInput({
    startDate: plan.startDate,
    birthDate: plan.birthDate,
    retirementAge,
    horizonAge: plan.horizonAge,
    inflation: plan.inflation,
    classes: resolveClasses(plan.classes, plan.scenario),
    accounts: plan.accounts.map((a, i) => ({
      id: a.id ?? `acc-${i}`, classId: a.classId, balance: a.balance, costBasis: a.costBasis, included: a.included,
    })),
    contribution:
      plan.contribution.monthly > 0
        ? { monthly: plan.contribution.monthly, realGrowth: plan.contribution.realGrowth, start: plan.startDate, end: null, allocation }
        : null,
    incomes:
      plan.inss.benefit > 0
        ? [{ type: "inss", monthly: plan.inss.benefit, startAge: plan.inss.startAge, endAge: null, realGrowth: plan.inss.realGrowth, taxable: false }]
        : [],
    expenses: plan.expenses.map((e) => ({ ...e, ageSteps: [] })),
    method: plan.method,
    redemptionOrder: plan.redemptionOrder,
  });
}

/** Meses entre hoje e uma idade (para converter para nominal). */
export function monthsUntilAge(plan: PlanData, age: number): number {
  return Math.max(0, Math.round(age * 12) - ageInMonths(plan.birthDate, plan.startDate));
}

export const currentAge = (plan: Pick<PlanData, "birthDate" | "startDate">) =>
  Math.floor(ageInMonths(plan.birthDate, plan.startDate) / 12);

export const toDisplay = (plan: PlanData, real: number, months: number, nominal: boolean) =>
  nominal ? real * nominalFactor(months, plan.inflation) : real;

/** Semáforo: verde = sem gap; amarelo = projetado ≥ 75% do necessário; vermelho = abaixo. */
export function trafficLight(patrimonioProjetado: number, necessario: number, exhausted: boolean): "verde" | "amarelo" | "vermelho" {
  if (necessario <= 0 || (patrimonioProjetado >= necessario && !exhausted)) return "verde";
  return patrimonioProjetado >= 0.75 * necessario ? "amarelo" : "vermelho";
}

export { estimateInssBenefit };
