"use client";

import { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, inputCls } from "@/components/ui";
import { useMonteCarlo } from "@/components/use-monte-carlo";
import { defaultCorrelation, nominalFactor, validateConfig, type MonteCarloConfig, type ReturnDistribution } from "@/lib/engine";
import { formatBRL, formatPercent } from "@/lib/format";
import { planToInput, type PlanData } from "@/lib/plan";

const PATHS = [1000, 2000, 5000];

function light(p: number) {
  if (p >= 0.9) return { cls: "bg-emerald-100 text-emerald-800", label: "Alta chance" };
  if (p >= 0.75) return { cls: "bg-amber-100 text-amber-800", label: "Atenção" };
  return { cls: "bg-red-100 text-red-800", label: "Risco elevado" };
}

export function MonteCarloView({ plan }: { plan: PlanData }) {
  const [age, setAge] = useState(plan.targetAges[0] ?? 60);
  const [paths, setPaths] = useState(2000);
  const [seed, setSeed] = useState(42);
  const [dist, setDist] = useState<ReturnDistribution>("lognormal");
  const [vols, setVols] = useState<number[]>(() => plan.classes.map((c) => c.volatility));
  const [corr, setCorr] = useState<number[][]>(() => defaultCorrelation(plan.classes.map((c) => c.volatility)));
  const [nominal, setNominal] = useState(false);
  const mc = useMonteCarlo();

  // Média de retorno = cenário base (spec), independentemente do cenário ativo do plano.
  const input = useMemo(() => planToInput({ ...plan, scenario: "base" }, age), [plan, age]);
  const config: MonteCarloConfig = { paths, seed, distribution: dist, volatilities: vols, correlation: corr };
  const configError = useMemo(() => validateConfig(input, config), [input, paths, seed, dist, vols, corr]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCorrCell = (i: number, j: number, v: number) =>
    setCorr((c) => c.map((row, r) => row.map((x, k) => ((r === i && k === j) || (r === j && k === i) ? v : x))));

  const r = mc.result;
  const f = (months: number) => (nominal ? nominalFactor(months, plan.inflation) : 1);
  const fan = useMemo(
    () => (r ? r.points.map((p, k) => {
      const b = r.bands[k]!; const fac = f(p.months);
      return { age: Number(p.age.toFixed(2)), base: b.p10 * fac, band: (b.p90 - b.p10) * fac, p50: b.p50 * fac, p10: b.p10 * fac, p90: b.p90 * fac };
    }) : []),
    [r, nominal, plan.inflation], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const atRetirement = r ? fan.reduce((best, p) => (Math.abs(p.age - r.retirementAge) < Math.abs(best.age - r.retirementAge) ? p : best), fan[0]!) : null;
  const hist = r ? r.exhaustion.histogram.map((h) => ({ age: h.age, pct: (h.count / r.paths) * 100 })) : [];
  const L = r ? light(r.probSurvive) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Monte Carlo</h1>
      <p className="text-sm text-zinc-600">
        Retornos anuais aleatórios por classe (média = cenário base, volatilidade e correlação editáveis) sobre o mesmo motor do plano.
        Roda em segundo plano, sem travar a tela. Resultados são probabilidades baseadas em premissas, não previsões.
      </p>

      <Card title="Parâmetros">
        <div className="grid gap-4 sm:grid-cols-4 text-sm">
          <label><span className="mb-1 block font-medium">Aposentadoria aos</span>
            <select aria-label="Idade de aposentadoria" className={inputCls} value={age} onChange={(e) => setAge(Number(e.target.value))}>
              {Array.from({ length: 26 }, (_, i) => 50 + i).map((a) => <option key={a} value={a}>{a} anos{plan.targetAges.includes(a) ? " ★" : ""}</option>)}
            </select></label>
          <label><span className="mb-1 block font-medium">Trajetórias</span>
            <select aria-label="Trajetórias" className={inputCls} value={paths} onChange={(e) => setPaths(Number(e.target.value))}>
              {PATHS.map((p) => <option key={p} value={p}>{p.toLocaleString("pt-BR")}</option>)}
            </select></label>
          <label><span className="mb-1 block font-medium">Distribuição</span>
            <select aria-label="Distribuição" className={inputCls} value={dist} onChange={(e) => setDist(e.target.value as ReturnDistribution)}>
              <option value="lognormal">Lognormal</option><option value="normal">Normal</option>
            </select></label>
          <label><span className="mb-1 block font-medium">Seed (reprodutível)</span>
            <input aria-label="Seed" className={inputCls} type="number" step={1} value={seed} onChange={(e) => setSeed(Math.trunc(Number(e.target.value)))} /></label>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-semibold">Volatilidade real anual e retorno médio por classe</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {plan.classes.map((c, i) => (
            <label key={c.id} className="block text-sm">
              <span className="mb-1 block">{c.name} <span className="text-zinc-500">· média {formatPercent(input.classes[i]!.realReturn - input.classes[i]!.annualCost)}</span></span>
              <input aria-label={`Volatilidade ${c.name}`} className={inputCls} type="number" step="0.5" min={0} value={Number((vols[i]! * 100).toFixed(2))}
                onChange={(e) => setVols((v) => v.map((x, k) => (k === i ? Number(e.target.value) / 100 : x)))} />
            </label>
          ))}
        </div>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">Matriz de correlação (simplificada, editável)</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="text-xs">
              <thead><tr><th />{plan.classes.map((c) => <th key={c.id} className="px-1 pb-1 font-medium">{c.name.split(" ")[0]}</th>)}</tr></thead>
              <tbody>
                {corr.map((row, i) => (
                  <tr key={i}>
                    <th className="pr-2 text-left font-medium">{plan.classes[i]!.name.split(" ")[0]}</th>
                    {row.map((v, j) => (
                      <td key={j} className="p-0.5">
                        <input aria-label={`Correlação ${plan.classes[i]!.name} x ${plan.classes[j]!.name}`} className={`${inputCls} !w-16 !px-2 !py-1`} type="number" step="0.05" min={-1} max={1}
                          disabled={i === j} value={v} onChange={(e) => setCorrCell(i, j, Number(e.target.value))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="ghost" className="mt-2" onClick={() => setCorr(defaultCorrelation(vols))}>Restaurar padrão</Button>
        </details>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!mc.running ? (
            <Button type="button" onClick={() => mc.run(input, config)} disabled={configError !== null}>Rodar simulação</Button>
          ) : (
            <Button type="button" variant="ghost" onClick={mc.cancel}>Cancelar</Button>
          )}
          {mc.running && (
            <div className="flex items-center gap-2 text-sm" role="progressbar" aria-valuenow={Math.round(mc.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 w-48 rounded bg-zinc-100"><div className="h-2 rounded bg-zinc-800" style={{ width: `${mc.progress * 100}%` }} /></div>
              {Math.round(mc.progress * 100)}%
            </div>
          )}
          {configError && <span role="alert" className="text-sm text-red-600">{configError}</span>}
          {mc.error && <span role="alert" className="text-sm text-red-600">{mc.error}</span>}
        </div>
      </Card>

      {r && L && atRetirement && (
        <>
          <div className="grid gap-3 sm:grid-cols-4" data-testid="mc-kpis">
            <Card className="!p-4"><div className="text-xs text-zinc-500">Chance de o dinheiro durar até {r.horizonAge}</div>
              <div className="text-2xl font-semibold tabular-nums" data-testid="mc-prob">{formatPercent(r.probSurvive)}</div>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${L.cls}`}>{L.label}</span></Card>
            <Card className="!p-4"><div className="text-xs text-zinc-500">Renda desejada atendida em todos os meses</div>
              <div className="text-2xl font-semibold tabular-nums">{formatPercent(r.probIncomeFullyMet)}</div></Card>
            <Card className="!p-4"><div className="text-xs text-zinc-500">Patrimônio mediano aos {r.retirementAge}</div>
              <div className="text-xl font-semibold tabular-nums">{formatBRL(atRetirement.p50)}</div>
              <div className="text-xs text-zinc-500">P10 {formatBRL(atRetirement.p10)} · P90 {formatBRL(atRetirement.p90)}</div></Card>
            <Card className="!p-4"><div className="text-xs text-zinc-500">Idade mediana de esgotamento</div>
              <div className="text-xl font-semibold">{r.exhaustion.median === null ? "—" : `${r.exhaustion.median.toFixed(1).replace(".", ",")} anos`}</div>
              <div className="text-xs text-zinc-500">{r.exhaustion.failures.toLocaleString("pt-BR")} de {r.paths.toLocaleString("pt-BR")} trajetórias esgotam</div></Card>
          </div>

          <Card title={`Patrimônio ao longo do tempo — P10 / P50 / P90 (${nominal ? "nominal" : "R$ de hoje"})`}>
            <div className="mb-2 inline-flex overflow-hidden rounded-md border border-zinc-300 text-sm" role="group" aria-label="Moeda">
              {[false, true].map((n) => (
                <button key={String(n)} type="button" aria-pressed={nominal === n} onClick={() => setNominal(n)}
                  className={`px-3 py-1.5 ${nominal === n ? "bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50"}`}>{n ? "Nominal" : "R$ de hoje"}</button>
              ))}
            </div>
            <div className="h-80 w-full" data-testid="mc-fan">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fan} margin={{ left: 8, right: 16, top: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => String(Math.round(v))} />
                  <YAxis width={64} tickFormatter={(v: number) => `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`} />
                  <Tooltip formatter={(v, name) => [formatBRL(Number(v)), String(name)]} labelFormatter={(l) => `Idade ${Number(l).toFixed(0)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="base" stackId="a" stroke="none" fill="transparent" legendType="none" isAnimationActive={false} />
                  <Area type="monotone" dataKey="band" stackId="a" name="Faixa P10–P90" stroke="none" fill="#2563eb" fillOpacity={0.18} isAnimationActive={false} />
                  <Line type="monotone" dataKey="p50" name="Mediana (P50)" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <ReferenceLine x={r.retirementAge} stroke="#52525b" strokeDasharray="4 4" label={{ value: `Apos. ${r.retirementAge}`, position: "top", fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Idade de esgotamento (entre todas as trajetórias)">
            {hist.length === 0 ? <p className="text-sm text-emerald-700">Nenhuma trajetória esgotou o patrimônio antes do horizonte.</p> : (
              <div className="h-60 w-full" data-testid="mc-hist">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hist} margin={{ left: 8, right: 16, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age" />
                    <YAxis width={48} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2).replace(".", ",")}% das trajetórias`} labelFormatter={(l) => `Esgota aos ${l} anos`} />
                    <Bar dataKey="pct" fill="#ea580c" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <p className="text-xs text-zinc-500">Seed {r.seed} · {r.paths.toLocaleString("pt-BR")} trajetórias · distribuição {dist}. Mesma seed e mesmas premissas reproduzem o mesmo resultado.</p>
        </>
      )}
    </div>
  );
}
