import { resolveClasses } from "@/lib/engine";
import type { Scenario } from "@/lib/engine";
import { contributionAllocation, type PlanData } from "@/lib/plan";

export interface AllocationRow {
  classId: string;
  name: string;
  balance: number;
  /** Fração da carteira que entra na aposentadoria. */
  current: number;
  /** Fração-alvo dos novos aportes (efetiva: alvo definido ou proporcional à carteira). */
  target: number;
  /** current − target (positivo = acima do alvo). */
  drift: number;
}

/** Alocação atual vs alvo, considerando apenas contas que entram na aposentadoria. */
export function allocationRows(plan: PlanData): AllocationRow[] {
  const included = plan.accounts.filter((a) => a.included);
  const total = included.reduce((s, a) => s + a.balance, 0);
  const target = contributionAllocation(plan);
  return plan.classes.map((c) => {
    const balance = included.filter((a) => a.classId === c.id).reduce((s, a) => s + a.balance, 0);
    const current = total > 0 ? balance / total : 0;
    const t = target[c.id] ?? 0;
    return { classId: c.id, name: c.name, balance, current, target: t, drift: current - t };
  });
}

/** Retorno real anual ponderado da carteira (líquido do custo anual de cada classe). */
export function weightedReturn(plan: PlanData, scenario: Scenario): number {
  const classes = new Map(resolveClasses(plan.classes, scenario).map((c) => [c.id, c]));
  const rows = allocationRows(plan);
  return rows.reduce((s, r) => {
    const c = classes.get(r.classId);
    return c ? s + r.current * (c.realReturn - c.annualCost) : s;
  }, 0);
}

/** Retorno ponderado por cenário, para exibição. */
export function weightedReturns(plan: PlanData): Record<Scenario, number> {
  return {
    pessimista: weightedReturn(plan, "pessimista"),
    base: weightedReturn(plan, "base"),
    otimista: weightedReturn(plan, "otimista"),
  };
}
