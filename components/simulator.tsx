"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { deleteSimulationAction, saveSimulationAction } from "@/app/simulador/actions";
import { WealthChart } from "@/components/wealth-chart";
import { Button, Card, Input } from "@/components/ui";
import { runSimulation } from "@/lib/engine";
import { formatBRL, formatDate, formatPercent } from "@/lib/format";
import { trafficLight, type PlanData } from "@/lib/plan";
import { defaultOverrides, overridesToInput, totalDesired, type SimOverrides } from "@/lib/simulator";
import type { SimulationSummary } from "@/db/queries/simulations";

export interface SavedSim { id: string; nome: string; createdAt: string; resumo: SimulationSummary }

function Slider({
  label, value, min, max, step, format, onChange, hint,
}: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex justify-between"><span className="font-medium text-zinc-700">{label}</span><span className="tabular-nums">{format(value)}</span></span>
      <input type="range" className="w-full accent-zinc-900" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const METHODS = [
  { value: "preservar_capital", label: "Preservar capital" },
  { value: "consumir_ate_horizonte", label: "Consumir até o horizonte" },
  { value: "taxa_fixa", label: "Taxa de retirada fixa" },
] as const;

const LIGHT = { verde: "bg-emerald-100 text-emerald-800", amarelo: "bg-amber-100 text-amber-800", vermelho: "bg-red-100 text-red-800" } as const;
const pp = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;

export function Simulator({ plan, saved, canSave = true }: { plan: PlanData; saved: SavedSim[]; canSave?: boolean }) {
  const [ov, setOv] = useState<SimOverrides>(() => defaultOverrides(plan));
  const [nominal, setNominal] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof SimOverrides>(k: K, v: SimOverrides[K]) => setOv((o) => ({ ...o, [k]: v }));

  // Sliders respondem na hora; o cálculo completo (com bisseções) acompanha com prioridade menor.
  const deferred = useDeferredValue(ov);
  const input = useMemo(() => overridesToInput(plan, deferred), [plan, deferred]);
  const res = useMemo(() => runSimulation(input), [input]);
  const light = trafficLight(res.patrimonioProjetado, res.patrimonioNecessario, res.idadeEsgotamento !== null);
  const stale = deferred !== ov;
  const baseDesired = totalDesired(plan);

  const save = () =>
    start(async () => {
      const r = await saveSimulationAction(name || `Simulação aos ${ov.retirementAge}`, input);
      setMsg(r.ok ? "Simulação salva." : r.error);
      if (r.ok) setName("");
    });

  const kpi = (label: string, value: string) => (
    <div className="rounded-lg border border-zinc-200 p-3"><div className="text-xs text-zinc-500">{label}</div><div className="font-semibold tabular-nums">{value}</div></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Simulador</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setOv(defaultOverrides(plan))}>Restaurar plano</Button>
          <div role="group" aria-label="Moeda" className="inline-flex overflow-hidden rounded-md border border-zinc-300 text-sm">
            {[false, true].map((n) => (
              <button key={String(n)} type="button" aria-pressed={nominal === n} onClick={() => setNominal(n)}
                className={`px-3 py-2 ${nominal === n ? "bg-zinc-900 text-white" : "bg-white hover:bg-zinc-50"}`}>{n ? "Nominal" : "R$ de hoje"}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card title="Parâmetros" className="space-y-4">
          <Slider label="Idade de aposentadoria" value={ov.retirementAge} min={50} max={75} step={1} format={(v) => `${v} anos`} onChange={(v) => set("retirementAge", v)} />
          <Slider label="Aporte mensal" value={ov.monthlyContribution} min={0} max={30000} step={100} format={formatBRL} onChange={(v) => set("monthlyContribution", v)} />
          <Slider label="Retorno real (ajuste em todas as classes)" value={ov.returnShift} min={-0.03} max={0.03} step={0.0025} format={pp} onChange={(v) => set("returnShift", v)}
            hint="Não altera títulos com taxa contratada." />
          <Slider label="Inflação de longo prazo" value={ov.inflation} min={0} max={0.1} step={0.0025} format={(v) => formatPercent(v)} onChange={(v) => set("inflation", v)}
            hint="Afeta só os valores nominais (o motor trabalha em R$ de hoje)." />
          <Slider label="Renda desejada (R$ de hoje/mês)" value={ov.desiredIncome} min={0} max={Math.max(40000, baseDesired * 2)} step={100} format={formatBRL} onChange={(v) => set("desiredIncome", v)}
            hint="Escala todas as metas de gasto proporcionalmente." />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">Método de retirada</span>
            <select className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={ov.method}
              onChange={(e) => set("method", e.target.value as SimOverrides["method"])}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        </Card>

        <div className="space-y-6">
          <Card className={stale ? "opacity-70" : ""}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Resultado — aposentando aos {deferred.retirementAge}</h2>
              <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${LIGHT[light]}`}>{light === "verde" ? "No caminho" : light === "amarelo" ? "Atenção" : "Insuficiente"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="kpis">
              {kpi("Patrimônio projetado", formatBRL(res.patrimonioProjetado))}
              {kpi("Patrimônio necessário", formatBRL(res.patrimonioNecessario))}
              {kpi(res.gap > 0 ? "Gap (falta)" : "Folga", formatBRL(Math.abs(res.gap)))}
              {kpi("Aporte necessário", res.aporteMensalNecessario === null ? "inalcançável" : formatBRL(res.aporteMensalNecessario))}
              {kpi("Renda sustentável", res.rendaSustentavel === null ? "—" : formatBRL(res.rendaSustentavel))}
              {kpi("Esgotamento", res.idadeEsgotamento === null ? `Dura até ${plan.horizonAge}` : `${res.idadeEsgotamento.toFixed(1).replace(".", ",")} anos`)}
            </div>
            {deferred.method !== "consumir_ate_horizonte" && !res.rendaDesejadaCabe && (
              <p className="mt-3 text-sm text-amber-800">Neste método a renda desejada não cabe em todos os meses.</p>
            )}
            {res.ponte && (
              <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                Ponte sem INSS ({res.ponte.months} meses): a carteira paga {formatBRL(res.ponte.grossWithdrawn)} ({formatPercent(res.ponte.shareOfPortfolio)} do patrimônio).
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
              <Input className="max-w-xs" placeholder="Nome da simulação" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              <Button onClick={save} disabled={pending || stale || !canSave}>{pending ? "Salvando…" : "Salvar simulação"}</Button>
              {msg && <span role="status" className="text-sm text-zinc-600">{msg}</span>}
            </div>
          </Card>
          <WealthChart results={[{ age: deferred.retirementAge, res }]} nominal={nominal} inssStartAge={plan.inss.startAge} />
        </div>
      </div>

      <Card title="Simulações salvas">
        {saved.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma ainda.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {saved.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{s.nome}</strong> <span className="text-zinc-500">· {formatDate(s.createdAt)} · aos {s.resumo.retirementAge}</span></span>
                <span className="tabular-nums text-zinc-600">projetado {formatBRL(s.resumo.patrimonioProjetado)} · necessário {formatBRL(s.resumo.patrimonioNecessario)}</span>
                <Button variant="ghost" onClick={() => start(async () => { await deleteSimulationAction(s.id); })}>Excluir</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
