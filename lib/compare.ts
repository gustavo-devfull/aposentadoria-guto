import { simulationInputSchema, type SimulationInput } from "@/lib/engine";
import type { SimulationSummary } from "@/db/queries/simulations";
import { formatBRL, formatPercent } from "@/lib/format";

export interface CompareItem {
  id: string;
  nome: string;
  input: SimulationInput;
  resumo: SimulationSummary;
}

export interface CompareRow {
  key: string;
  label: string;
  values: string[];
  /** true se os valores diferem entre as simulações. */
  differs: boolean;
}

const METHOD = { preservar_capital: "Preservar capital", consumir_ate_horizonte: "Consumir até o horizonte", taxa_fixa: "Taxa fixa" } as const;
const age = (v: number | null) => (v === null ? "Dura até o horizonte" : `${v.toFixed(1).replace(".", ",")} anos`);

const sumExpenses = (i: SimulationInput) => i.expenses.reduce((s, e) => s + e.monthly, 0);
const portfolio = (i: SimulationInput) => i.accounts.filter((a) => a.included).reduce((s, a) => s + a.balance, 0);
const incomeOf = (i: SimulationInput, type: string) => i.incomes.filter((x) => x.type === type).reduce((s, x) => s + x.monthly, 0);

/** Premissas e resultados lado a lado, marcando o que difere. */
export function compareSimulations(items: CompareItem[]): { premissas: CompareRow[]; resultados: CompareRow[] } {
  const row = (key: string, label: string, f: (c: CompareItem) => string): CompareRow => {
    const values = items.map(f);
    return { key, label, values, differs: new Set(values).size > 1 };
  };
  const classReturn = (c: CompareItem, id: string) => c.input.classes.find((k) => k.id === id);
  const classIds = [...new Set(items.flatMap((c) => c.input.classes.map((k) => k.id)))];

  const premissas = [
    row("retirementAge", "Idade de aposentadoria", (c) => `${c.input.retirementAge} anos`),
    row("horizon", "Horizonte", (c) => `${c.input.horizonAge} anos`),
    row("inflation", "Inflação de longo prazo", (c) => formatPercent(c.input.inflation)),
    row("method", "Método de retirada", (c) => METHOD[c.input.method]),
    row("monthly", "Aporte mensal", (c) => formatBRL(c.input.contribution?.monthly ?? 0)),
    row("growth", "Reajuste real do aporte", (c) => formatPercent(c.input.contribution?.realGrowth ?? 0)),
    row("expenses", "Renda desejada (R$ de hoje/mês)", (c) => formatBRL(sumExpenses(c.input))),
    row("inss", "Benefício do INSS", (c) => formatBRL(incomeOf(c.input, "inss"))),
    row("portfolio", "Carteira na simulação", (c) => formatBRL(portfolio(c.input))),
    ...classIds.map((id) =>
      row(`ret:${id}`, `Retorno real — ${items.map((c) => classReturn(c, id)?.name).find(Boolean) ?? id}`, (c) => {
        const k = classReturn(c, id);
        return k ? formatPercent(k.realReturn - k.annualCost) : "—";
      }),
    ),
  ];
  const resultados = [
    row("proj", "Patrimônio projetado", (c) => formatBRL(c.resumo.patrimonioProjetado)),
    row("need", "Patrimônio necessário", (c) => formatBRL(c.resumo.patrimonioNecessario)),
    row("gap", "Gap (negativo = folga)", (c) => formatBRL(c.resumo.gap)),
    row("aporte", "Aporte necessário", (c) => (c.resumo.aporteMensalNecessario === null ? "inalcançável" : formatBRL(c.resumo.aporteMensalNecessario))),
    row("renda", "Renda sustentável", (c) => (c.resumo.rendaSustentavel === null ? "—" : formatBRL(c.resumo.rendaSustentavel))),
    row("exhaust", "Idade de esgotamento", (c) => age(c.resumo.idadeEsgotamento)),
    row("ponte", "Patrimônio consumido na ponte", (c) => (c.resumo.ponteShare === null ? "sem ponte" : formatPercent(c.resumo.ponteShare))),
  ];
  return { premissas, resultados };
}

/** Revalida o snapshot salvo (jsonb) antes de usar. */
export function parseSavedInput(raw: unknown): SimulationInput | null {
  const r = simulationInputSchema.safeParse(raw);
  return r.success ? r.data : null;
}
