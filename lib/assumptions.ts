import { z } from "zod";
import { scenarioSchema, withdrawalMethodSchema, redemptionOrderSchema } from "@/lib/engine";
import { formatBRL, formatPercent } from "@/lib/format";

export const classSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  pessimista: z.number().min(-0.5).max(0.5),
  base: z.number().min(-0.5).max(0.5),
  otimista: z.number().min(-0.5).max(0.5),
  contracted: z.number().min(-0.5).max(0.5).nullable(),
  annualCost: z.number().min(0).max(0.2),
});

export const assumptionInputSchema = z.object({
  nome: z.string().min(1).max(120),
  inflation: z.number().min(0).max(0.3),
  scenario: scenarioSchema,
  method: withdrawalMethodSchema,
  redemptionOrder: redemptionOrderSchema,
  fixedWithdrawalRate: z.number().min(0).max(0.3).nullable(),
  minimumWage: z.number().min(0),
  ceiling: z.number().min(0),
  notes: z.string().max(2000).nullable(),
  classes: z.array(classSnapshotSchema).min(1),
});
export type AssumptionInput = z.infer<typeof assumptionInputSchema>;

export interface AssumptionVersion extends AssumptionInput {
  versao: number;
  createdAt: string;
}

export interface DiffEntry {
  key: string;
  label: string;
  before: string;
  after: string;
}

const METHOD_LABEL = {
  preservar_capital: "Preservar capital",
  consumir_ate_horizonte: "Consumir até o horizonte",
  taxa_fixa: "Taxa de retirada fixa",
} as const;
const ORDER_LABEL = { proporcional: "Proporcional à carteira", menor_ir_primeiro: "Menor IR primeiro" } as const;
const pct = (v: number | null) => (v === null ? "—" : formatPercent(v));
const approxEq = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-9);

/** Diferenças entre duas versões de premissas (somente o que mudou). */
export function diffVersions(a: AssumptionInput, b: AssumptionInput): DiffEntry[] {
  const out: DiffEntry[] = [];
  const push = (key: string, label: string, before: string, after: string, same: boolean) => {
    if (!same) out.push({ key, label, before, after });
  };
  push("nome", "Nome", a.nome, b.nome, a.nome === b.nome);
  push("inflation", "Inflação de longo prazo", pct(a.inflation), pct(b.inflation), approxEq(a.inflation, b.inflation));
  push("scenario", "Cenário", a.scenario, b.scenario, a.scenario === b.scenario);
  push("method", "Método de retirada", METHOD_LABEL[a.method], METHOD_LABEL[b.method], a.method === b.method);
  push("order", "Ordem de resgate", ORDER_LABEL[a.redemptionOrder], ORDER_LABEL[b.redemptionOrder], a.redemptionOrder === b.redemptionOrder);
  push("rate", "Taxa de retirada", pct(a.fixedWithdrawalRate), pct(b.fixedWithdrawalRate), approxEq(a.fixedWithdrawalRate, b.fixedWithdrawalRate));
  push("minimumWage", "Salário mínimo", formatBRL(a.minimumWage), formatBRL(b.minimumWage), approxEq(a.minimumWage, b.minimumWage));
  push("ceiling", "Teto do INSS", formatBRL(a.ceiling), formatBRL(b.ceiling), approxEq(a.ceiling, b.ceiling));
  push("notes", "Observações", a.notes ?? "—", b.notes ?? "—", (a.notes ?? "") === (b.notes ?? ""));

  const before = new Map(a.classes.map((c) => [c.id, c]));
  const after = new Map(b.classes.map((c) => [c.id, c]));
  for (const [id, cb] of after) {
    const ca = before.get(id);
    if (!ca) {
      out.push({ key: `class:${id}`, label: `Classe "${cb.name}"`, before: "não existia", after: "adicionada" });
      continue;
    }
    const fields = [
      ["pessimista", "pessimista"], ["base", "base"], ["otimista", "otimista"],
      ["contracted", "taxa contratada"], ["annualCost", "custo anual"],
    ] as const;
    for (const [f, label] of fields)
      push(`class:${id}:${f}`, `${cb.name} — ${label}`, pct(ca[f]), pct(cb[f]), approxEq(ca[f], cb[f]));
  }
  for (const [id, ca] of before)
    if (!after.has(id)) out.push({ key: `class:${id}`, label: `Classe "${ca.name}"`, before: "existia", after: "removida" });
  return out;
}
