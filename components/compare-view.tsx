"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteScenarioAction } from "@/app/simulador/actions";
import { COLORS } from "@/components/retirement-results";
import { Button, Card } from "@/components/ui";
import { formatBRL0, formatDate, formatPercent } from "@/lib/format";
import { RETIREMENT_AGES, toSimpleInput } from "@/lib/plan";
import { simulateRetirement } from "@/lib/simulator";
import type { Scenario } from "@/db/queries/scenarios";

/** `sub`: linha secundária (valor projetado); `best`: índice do maior valor (destacado). */
interface Row { label: string; values: string[]; sub?: string[]; differs: boolean; best?: number }

const row = (label: string, values: string[], sub?: string[], nums?: (number | null)[]): Row => {
  const differs = new Set(values).size > 1;
  const valid = (nums ?? []).map((n, i) => [n, i] as const).filter((x): x is readonly [number, number] => x[0] !== null);
  const best = differs && valid.length > 1 ? valid.reduce((a, b) => (b[0] > a[0] ? b : a))[1] : undefined;
  return { label, values, sub, differs, best };
};

export function CompareView({ scenarios, canDelete = true }: { scenarios: Scenario[]; canDelete?: boolean }) {
  const [selected, setSelected] = useState<string[]>(() => scenarios.slice(0, 3).map((s) => s.id));
  const [pending, start] = useTransition();
  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));
  const chosen = useMemo(() => scenarios.filter((s) => selected.includes(s.id)), [selected, scenarios]);

  const tables = useMemo(() => {
    const inputs = chosen.map((s) => toSimpleInput(s.input));
    const premissas = [
      row("Idade atual", inputs.map((i) => `${i.currentAge} anos`)),
      row("Investido hoje", chosen.map((s) => formatBRL0(s.input.invested))),
      row("Aporte mensal", chosen.map((s) => formatBRL0(s.input.monthly))),
      row("Taxa de juros", chosen.map((s) => `${formatPercent(s.input.annualRate)} a.a.`)),
      row("Inflação", chosen.map((s) => `${formatPercent(s.input.inflation)} a.a.`)),
      row("INSS", chosen.map((s) => `${formatBRL0(s.input.inssBenefit)} aos ${s.input.inssStartAge}`)),
      row("Renda dura até", chosen.map((s) => `${s.input.horizonAge} anos`)),
    ];
    const resultados = RETIREMENT_AGES.flatMap((age) => {
      const res = inputs.map((i) => (age > i.currentAge ? simulateRetirement(i, age) : null));
      type R = NonNullable<(typeof res)[number]>;
      const year = new Date().getFullYear();
      const v = (f: (r: R) => number) => res.map((r) => (r ? formatBRL0(f(r)) : "—"));
      const n = (f: (r: R) => number) => res.map((r) => (r ? f(r) : null));
      const proj = (f: (r: R) => number) =>
        res.map((r) => (r ? `${formatBRL0(f(r))} em ${year + Math.round(r.anosAteAposentadoria)}` : ""));
      return [
        row(`Patrimônio aos ${age}`, v((r) => r.patrimonio), proj((r) => r.projetado.patrimonio), n((r) => r.patrimonio)),
        row(`Renda só dos juros (aos ${age})`, v((r) => r.rendaJuros), proj((r) => r.projetado.rendaJuros), n((r) => r.rendaJuros)),
        row(`Renda consumindo (aos ${age})`, v((r) => r.rendaConsumo), proj((r) => r.projetado.rendaConsumo), n((r) => r.rendaConsumo)),
      ];
    });
    return { premissas, resultados };
  }, [chosen]);

  const table = (title: string, rows: Row[], testId: string) => (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm" data-testid={testId}>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-normal">&nbsp;</th>
              {chosen.map((c, i) => (
                <th key={c.id} className="pb-2 font-medium text-fg">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.nome}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={`border-t border-line ${r.differs && r.best === undefined ? "bg-warn-soft" : ""}`}>
                <td className="py-2 pr-3 text-muted">{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={`py-2 pr-2 tabular-nums ${r.differs ? "font-semibold" : ""}`}>
                    <span className={r.best === i ? "rounded-md bg-good-soft px-1.5 py-0.5 text-good" : ""}>{v}</span>
                    {r.sub?.[i] && <span className="mt-0.5 block text-[11px] font-normal text-muted">projetado: {r.sub[i]}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comparar cenários</h1>
        <p className="mt-1 text-sm text-muted">Salve cenários no Simulador e compare até três lado a lado.</p>
      </div>
      {scenarios.length < 2 ? (
        <Card><p className="text-sm text-muted">Salve pelo menos dois cenários no Simulador para compará-los.</p></Card>
      ) : (
        <>
          <Card title="Escolha de 2 a 3 cenários">
            <ul className="divide-y divide-line">
              {scenarios.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} disabled={!on && selected.length >= 3} onChange={() => toggle(s.id)} />
                      <span><strong className="font-medium">{s.nome}</strong> <span className="text-muted">· {formatDate(s.createdAt)}</span></span>
                    </label>
                    {canDelete && (
                      <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await deleteScenarioAction(s.id); })}>Excluir</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {chosen.length >= 2 ? (
            <>
              {table("Resultados em R$ de hoje (em verde, o melhor)", tables.resultados, "compare-results")}
              {table("Premissas (em amarelo, o que difere)", tables.premissas, "compare-premises")}
            </>
          ) : <p className="text-sm text-muted">Selecione ao menos dois.</p>}
        </>
      )}
    </div>
  );
}
