import { planToInput, type PlanData } from "@/lib/plan";
import type { SimulationInput, WithdrawalMethod } from "@/lib/engine";

/** Ajustes do simulador sobre o plano salvo (nada é gravado até clicar em "Salvar simulação"). */
export interface SimOverrides {
  retirementAge: number;
  monthlyContribution: number;
  /** Deslocamento em pontos percentuais somado ao retorno real de cada classe (fração: 0.01 = +1 p.p.). */
  returnShift: number;
  inflation: number;
  /** Renda desejada total (R$/mês de hoje); escala todas as metas de gasto proporcionalmente. */
  desiredIncome: number;
  method: WithdrawalMethod;
}

export const totalDesired = (plan: Pick<PlanData, "expenses">) => plan.expenses.reduce((s, e) => s + e.monthly, 0);

export function defaultOverrides(plan: PlanData): SimOverrides {
  return {
    retirementAge: plan.targetAges[0] ?? 60,
    monthlyContribution: plan.contribution.monthly,
    returnShift: 0,
    inflation: plan.inflation,
    desiredIncome: totalDesired(plan),
    method: plan.method,
  };
}

/**
 * Aplica os ajustes e devolve o input do motor.
 * O deslocamento de retorno não altera classes com taxa real contratada (IPCA+ já comprado).
 */
export function overridesToInput(plan: PlanData, o: SimOverrides): SimulationInput {
  const base = totalDesired(plan);
  const k = base > 0 ? o.desiredIncome / base : 1;
  const adjusted: PlanData = {
    ...plan,
    inflation: o.inflation,
    method: o.method,
    contribution: { ...plan.contribution, monthly: o.monthlyContribution },
    expenses: plan.expenses.map((e) => ({ ...e, monthly: e.monthly * k })),
    classes: plan.classes.map((c) =>
      c.contractedRealRate !== undefined
        ? c
        : { ...c, returns: { pessimista: c.returns.pessimista + o.returnShift, base: c.returns.base + o.returnShift, otimista: c.returns.otimista + o.returnShift } },
    ),
  };
  return planToInput(adjusted, o.retirementAge);
}
