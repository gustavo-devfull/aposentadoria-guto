"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui";
import { runSimulation, type SimulationResult } from "@/lib/engine";
import { formatBRL, formatPercent } from "@/lib/format";
import { currentAge, monthsUntilAge, planToInput, toDisplay, trafficLight, type PlanData } from "@/lib/plan";

const LIGHT = {
  verde: { cls: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "No caminho" },
  amarelo: { cls: "bg-amber-100 text-amber-800 border-amber-300", label: "Atenção" },
  vermelho: { cls: "bg-red-100 text-red-800 border-red-300", label: "Insuficiente" },
} as const;
const COLORS = ["#2563eb", "#ea580c", "#16a34a"];

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

  const chartData = useMemo(() => {
    const byAge = new Map<number, Record<string, number>>();
    for (const { age, res } of results) {
      for (const row of res.tabelaAnual) {
        const rec = byAge.get(row.age) ?? { age: row.age };
        rec[`a${age}`] = Math.round(nominal ? row.closing.nominal : row.closing.real);
        byAge.set(row.age, rec);
      }
    }
    return [...byAge.values()].sort((a, b) => a.age! - b.age!);
  }, [results, nominal]);

  const ticks = useMemo(() => {
    const first = chartData[0]?.age ?? 0;
    const last = chartData.at(-1)?.age ?? first;
    const t = [first];
    for (let a = Math.ceil((first + 1) / 5) * 5; a < last; a += 5) t.push(a);
    t.push(last);
    return t;
  }, [chartData]);

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

      <Card title={`Evolução do patrimônio (${nominal ? "nominal" : "R$ de hoje"})`}>
        <div className="h-80 w-full" data-testid="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 8, right: 16, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} ticks={ticks} />
              <YAxis tickFormatter={(v: number) => `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`} width={64} />
              <Tooltip formatter={(v) => formatBRL(Number(v))} labelFormatter={(l) => `Idade ${l}`} />
              <Legend />
              {results.map(({ age }, i) => (
                <Area key={age} type="monotone" dataKey={`a${age}`} name={`Aposentando aos ${age}`}
                  stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
              ))}
              {results.map(({ age }) => (
                <ReferenceLine key={`r${age}`} x={age} stroke="#52525b" strokeDasharray="4 4"
                  label={{ value: `Apos. ${age}`, position: "top", fontSize: 11 }} />
              ))}
              <ReferenceLine x={plan.inss.startAge} stroke="#16a34a" strokeDasharray="2 4"
                label={{ value: "INSS", position: "insideBottomRight", fontSize: 11, fill: "#16a34a" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
