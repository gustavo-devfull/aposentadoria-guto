"use client";

import { useMemo, useState } from "react";
import { Button, Card, inputCls } from "@/components/ui";
import { annualTableToCsv, type CsvMode } from "@/lib/csv";
import { runSimulation } from "@/lib/engine";
import { formatBRL } from "@/lib/format";
import { planToInput, type PlanData } from "@/lib/plan";

export function AnnualTableView({ plan }: { plan: PlanData }) {
  const [age, setAge] = useState(plan.targetAges[0] ?? 60);
  const [mode, setMode] = useState<CsvMode>("real");
  const rows = useMemo(() => runSimulation(planToInput(plan, age), { solve: false }).tabelaAnual, [plan, age]);

  const download = () => {
    const blob = new Blob([annualTableToCsv(rows, mode)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabela-anual-aposentadoria-${age}-${mode === "real" ? "reais-de-hoje" : "nominal"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tabela anual</h1>
      <Card>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label><span className="mb-1 block font-medium">Aposentadoria aos</span>
            <select aria-label="Idade de aposentadoria" className={`${inputCls} !w-auto`} value={age} onChange={(e) => setAge(Number(e.target.value))}>
              {Array.from({ length: 26 }, (_, i) => 50 + i).map((a) => <option key={a} value={a}>{a} anos{plan.targetAges.includes(a) ? " ★" : ""}</option>)}
            </select></label>
          <div role="group" aria-label="Moeda" className="inline-flex overflow-hidden rounded-md border border-zinc-300">
            {(["real", "nominal"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                className={`px-3 py-2 ${mode === m ? "bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50"}`}>{m === "real" ? "R$ de hoje" : "Nominal"}</button>
            ))}
          </div>
          <Button type="button" onClick={download}>Exportar CSV</Button>
        </div>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[820px] text-sm" data-testid="annual-table">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr><th className="p-2">Idade</th><th>Saldo inicial</th><th>Aportes</th><th>Rendimentos</th><th>Saques (bruto)</th><th>IR</th><th>Rendas externas</th><th>Saldo final</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.age} className={`border-t border-zinc-100 tabular-nums ${r.age === age ? "bg-amber-50" : ""}`}>
                <td className="p-2 font-medium">{r.age}</td>
                <td>{formatBRL(r.opening[mode])}</td><td>{formatBRL(r.contributions[mode])}</td><td>{formatBRL(r.returns[mode])}</td>
                <td>{formatBRL(r.withdrawals[mode])}</td><td>{formatBRL(r.tax[mode])}</td><td>{formatBRL(r.externalIncome[mode])}</td>
                <td className="font-medium">{formatBRL(r.closing[mode])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
