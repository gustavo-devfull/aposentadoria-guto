"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { WealthChart } from "@/components/wealth-chart";
import { runSimulation, type SimulationResult } from "@/lib/engine";
import { formatBRL, formatPercent } from "@/lib/format";
import { currentAge, monthsUntilAge, planToInput, toDisplay, trafficLight, type PlanData } from "@/lib/plan";

const LIGHT = {
  verde: { cls: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "No caminho" },
  amarelo: { cls: "bg-amber-100 text-amber-800 border-amber-300", label: "Atenção" },
  vermelho: { cls: "bg-red-100 text-red-800 border-red-300", label: "Insuficiente" },
} as const;

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-2 last:border-0">
      <dt className="text-sm text-zinc-600">{label}</dt>
      <dd className="text-right">
        <span className="font-semibold tabular-nums">{value}</span>
        {sub && <span className="block text-xs text-zinc-500 tabular-nums">{sub}</span>}
      </dd>
    </div>
  );
}

export function Dashboard({ plan }: { plan: PlanData }) {
  const [nominal, setNominal] = useState(false);

  const results = useMemo(
    () => plan.targetAges.map((age) => ({ age, res: runSimulation(planToInput(plan, age)) as SimulationResult })),
    [plan],
  );

  const fmt = (real: number, age: number) => formatBRL(toDisplay(plan, real, monthsUntilAge(plan, age), nominal));
  const sub = (real: number, age: number) =>
    nominal ? `${formatBRL(real)} em R$ de hoje` : `${formatBRL(toDisplay(plan, real, monthsUntilAge(plan, age), true))} nominal`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-600">
            Idade atual: {currentAge(plan)} anos · horizonte {plan.horizonAge} · cenário {plan.scenario}
          </p>
        </div>
        <div role="group" aria-label="Moeda" className="inline-flex overflow-hidden rounded-md border border-zinc-300 text-sm">
          {[false, true].map((n) => (
            <button key={String(n)} type="button" aria-pressed={nominal === n} onClick={() => setNominal(n)}
              className={`px-3 py-1.5 ${nominal === n ? "bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50"}`}>
              {n ? "Nominal" : "R$ de hoje"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2" data-testid="cards">
        {results.map(({ age, res }) => {
          const light = trafficLight(res.patrimonioProjetado, res.patrimonioNecessario, res.idadeEsgotamento !== null);
          return (
            <Card key={age} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Aposentar aos {age}</h2>
                <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${LIGHT[light].cls}`}>{LIGHT[light].label}</span>
              </div>
              <dl>
                <Row label="Patrimônio projetado" value={fmt(res.patrimonioProjetado, age)} sub={sub(res.patrimonioProjetado, age)} />
                <Row label="Patrimônio necessário" value={fmt(res.patrimonioNecessario, age)} sub={sub(res.patrimonioNecessario, age)} />
                <Row label={res.gap > 0 ? "Gap (falta)" : "Folga"} value={fmt(Math.abs(res.gap), age)} />
                <Row label="Aporte mensal necessário"
                  value={res.aporteMensalNecessario === null ? "inalcançável" : formatBRL(res.aporteMensalNecessario)} />
                <Row label="Renda sustentável (R$ de hoje)"
                  value={res.rendaSustentavel === null ? "—" : formatBRL(res.rendaSustentavel)} sub="por mês, total incluindo INSS" />
                <Row label="Idade de esgotamento"
                  value={res.idadeEsgotamento === null ? `Dura até ${plan.horizonAge}` : `${res.idadeEsgotamento.toFixed(1).replace(".", ",")} anos`} />
              </dl>
              {res.ponte && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Ponte sem INSS: {age} → {res.ponte.inssStartAge} anos ({res.ponte.months} meses)</strong>
                  <p>
                    A carteira cobre 100% do período: saca {fmt(res.ponte.grossWithdrawn, age)} ({formatPercent(res.ponte.shareOfPortfolio)} do
                    patrimônio) antes do INSS começar.
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <WealthChart results={results} nominal={nominal} inssStartAge={plan.inss.startAge} />
    </div>
  );
}
