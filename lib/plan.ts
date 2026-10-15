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
      institution: z.string().nullish(),
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
        ageSteps: z.array(z.object({ fromAge: z.number().min(0).max(120), factor: z.number().min(0).max(5) })),
      }),
    )
    .min(1, "Informe ao menos uma meta de gasto"),
});
export type PlanForm = z.infer<typeof planFormSchema>;

const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use AAAA-MM");

export const incomeFormSchema = z.object({
  type: z.enum(["aluguel", "trabalho_parcial", "renda_mais", "outro"]),
  description: z.string().max(120).nullable(),
  monthly: z.number().min(0),
  startAge: z.number().min(0).max(120),
  endAge: z.number().min(0).max(120).nullable(),
  realGrowth: z.number().min(-0.5).max(1),
  taxable: z.boolean(),
});
export type IncomeForm = z.infer<typeof incomeFormSchema>;

export const extraFormSchema = z.object({
  description: z.string().max(120).nullable(),
  amount: z.number().min(0),
  month: z.number().int().min(1).max(12),
  /** null + yearly = todo ano (13º, PLR). */
  year: z.number().int().min(2000).max(2200).nullable(),
  yearly: z.boolean(),
});
export type ExtraForm = z.infer<typeof extraFormSchema>;

export const pauseFormSchema = z.object({ from: ym, to: ym, reason: z.string().max(120).nullable() })
  .refine((v) => v.to >= v.from, { message: "O fim deve ser depois do início", path: ["to"] });
export type PauseForm = z.infer<typeof pauseFormSchema>;

export const inssIncreaseSchema = z.object({
  enabled: z.boolean(),
  newContributionSalary: z.number().min(0),
  from: ym,
});
export type InssIncrease = z.infer<typeof inssIncreaseSchema>;

/** Fração por classe (soma 1) — alocação alvo dos novos aportes. */
export const allocationSchema = z.record(z.string(), z.number().min(0).max(1)).refine(
  (a) => Object.keys(a).length === 0 || Math.abs(Object.values(a).reduce((x, y) => x + y, 0) - 1) < 1e-6,
  { message: "A alocação alvo deve somar 100%" },
);

export interface PlanData extends PlanForm {
  /** Mês atual "AAAA-MM". */
  startDate: string;
  scenario: z.infer<typeof scenarioSchema>;
  inflation: number;
  method: z.infer<typeof withdrawalMethodSchema>;
  redemptionOrder: z.infer<typeof redemptionOrderSchema>;
  classes: AssetClassTemplate[];
  fixedWithdrawalRate: number;
  inssParams: { minimumWage: number; ceiling: number };
  inssIncrease: InssIncrease | null;
  otherIncomes: IncomeForm[];
  extras: ExtraForm[];
  pauses: PauseForm[];
  /** Alocação alvo dos aportes (vazia = proporcional à carteira atual). */
  targetAllocation: Record<string, number>;
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
      { category: "essencial", monthly: 6000, startAge: 60, endAge: null, extraInflation: 0, ageSteps: [] },
      { category: "saude", monthly: 1500, startAge: 60, endAge: null, extraInflation: 0.03, ageSteps: [] },
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
    fixedWithdrawalRate: 0.04,
    inssParams: { minimumWage: DEFAULT_INSS_PARAMS.minimumWage, ceiling: DEFAULT_INSS_PARAMS.ceiling },
    inssIncrease: null,
    otherIncomes: [],
    extras: [],
    pauses: [],
    targetAllocation: {},
    ...over,
  };
}

/** Benefício do INSS usado no motor: manual, ou aproximação do cenário "aumentar contribuição". */
export function inssBenefitFor(plan: PlanData, retirementAge: number): number {
  const inc = plan.inssIncrease;
  if (!inc?.enabled) return plan.inss.benefit;
  return estimateInssBenefit({
    contributionYearsSoFar: plan.inss.contributionYears,
    historicalAverageSalary: plan.inss.contributionSalary,
    currentContributionSalary: plan.inss.contributionSalary,
    startDate: plan.startDate,
    stopContributingAge: retirementAge,
    ageAtStartYears: ageInMonths(plan.birthDate, plan.startDate) / 12,
    minimumWage: plan.inssParams.minimumWage,
    ceiling: plan.inssParams.ceiling,
    increase: { newContributionSalary: inc.newContributionSalary, from: inc.from },
  }).benefit;
}

/** Alocação efetiva dos aportes: alvo (se definida) ou proporcional à carteira incluída. */
export function contributionAllocation(plan: PlanData): Record<string, number> {
  const target = plan.targetAllocation;
  if (Object.keys(target).length > 0 && Math.abs(Object.values(target).reduce((x, y) => x + y, 0) - 1) < 1e-6) return target;
  const included = plan.accounts.filter((a) => a.included);
  const total = included.reduce((s, a) => s + a.balance, 0);
  const allocation: Record<string, number> = {};
  if (total > 0) for (const a of included) allocation[a.classId] = (allocation[a.classId] ?? 0) + a.balance / total;
  else if (plan.classes[0]) allocation[plan.classes[0].id] = 1;
  return allocation;
}

/** Monta o SimulationInput validado para uma idade de aposentadoria. */
export function planToInput(plan: PlanData, retirementAge: number): SimulationInput {
  const allocation = contributionAllocation(plan);
  const inssBenefit = inssBenefitFor(plan, retirementAge);
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
    extras: plan.extras.map((e) => ({ amount: e.amount, month: e.month, year: e.year ?? undefined, yearly: e.yearly })),
    pauses: plan.pauses.map((p) => ({ from: p.from, to: p.to })),
    incomes: [
      ...(inssBenefit > 0
        ? [{ type: "inss" as const, monthly: inssBenefit, startAge: plan.inss.startAge, endAge: null, realGrowth: plan.inss.realGrowth, taxable: false }]
        : []),
      ...plan.otherIncomes.map((i) => ({ type: i.type, monthly: i.monthly, startAge: i.startAge, endAge: i.endAge, realGrowth: i.realGrowth, taxable: i.taxable })),
    ],
    expenses: plan.expenses,
    method: plan.method,
    fixedWithdrawalRate: plan.fixedWithdrawalRate,
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
