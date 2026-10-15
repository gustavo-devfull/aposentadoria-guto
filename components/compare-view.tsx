"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { compareSimulations, type CompareItem, type CompareRow } from "@/lib/compare";
import { formatDate } from "@/lib/format";

export function CompareView({ sims }: { sims: (CompareItem & { createdAt: string })[] }) {
  const [selected, setSelected] = useState<string[]>(() => sims.slice(0, 2).map((s) => s.id));
  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));
  const chosen = useMemo(() => selected.flatMap((id) => sims.filter((s) => s.id === id)), [selected, sims]);
  const out = useMemo(() => (chosen.length >= 2 ? compareSimulations(chosen) : null), [chosen]);

  const table = (title: string, rows: CompareRow[], testId: string) => (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm" data-testid={testId}>
          <thead><tr className="text-left text-xs text-zinc-500"><th className="pb-1">&nbsp;</th>{chosen.map((c) => <th key={c.id} className="pb-1">{c.nome}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`border-t border-zinc-100 ${r.differs ? "bg-amber-50" : ""}`}>
                <td className="py-1.5 pr-3 text-zinc-600">{r.label}</td>
                {r.values.map((v, i) => <td key={i} className={`tabular-nums ${r.differs ? "font-semibold" : ""}`}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Comparar simulações</h1>
      {sims.length < 2 ? (
        <Card><p className="text-sm text-zinc-600">Salve pelo menos duas simulações no Simulador para compará-las.</p></Card>
      ) : (
        <>
          <Card title="Escolha de 2 a 3 simulações">
            <ul className="grid gap-2 sm:grid-cols-2">
              {sims.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={on} disabled={!on && selected.length >= 3} onChange={() => toggle(s.id)} />
                      <span><strong>{s.nome}</strong> <span className="text-zinc-500">· {formatDate(s.createdAt)} · aos {s.resumo.retirementAge}</span></span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
          {out ? (
            <>
              {table("Resultados", out.resultados, "compare-results")}
              {table("Premissas (destacado = difere)", out.premissas, "compare-premises")}
            </>
          ) : <p className="text-sm text-zinc-600">Selecione ao menos duas.</p>}
        </>
      )}
    </div>
  );
}
