"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui";
import { formatBRL0 } from "@/lib/format";
import { RETIREMENT_AGES } from "@/lib/plan";
import { simulateRetirement, wealthByAge, type SimpleInput, type SimpleResult } from "@/lib/simulator";

export const COLORS = ["#3b82f6", "#f97316", "#10b981"];
const thisYear = () => new Date().getFullYear();
const compact = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : formatBRL0(v);

export function useResults(input: SimpleInput) {
  return useMemo(() => RETIREMENT_AGES.filter((a) => a > input.currentAge).map((a) => simulateRetirement(input, a)), [input]);
}

function DetailTable({ res, input }: { res: SimpleResult; input: SimpleInput }) {
  const p = res.projetado;
  const yRet = thisYear() + Math.round(res.anosAteAposentadoria);
  const yInss = thisYear() + Math.round(res.anosAteInss);
  const bridge = res.retirementAge < input.inssStartAge;
  const row = (label: string, today: number, projected: number, year: number, strong = false) => (
    <tr className="border-t border-line">
      <td className="py-2 pr-2 text-muted">{label}</td>
      <td className={`py-2 pl-2 text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{formatBRL0(today)}</td>
      <td className="py-2 pl-2 text-right tabular-nums">
        {formatBRL0(projected)}<span className="block text-[11px] text-muted">em {year}</span>
      </td>
    </tr>
  );
  const section = (title: string) => <tr><td colSpan={3} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted">{title}</td></tr>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted">
          <th className="pb-1 text-left font-normal">&nbsp;</th>
          <th className="pb-1 text-right font-normal">R$ de hoje</th>
          <th className="pb-1 text-right font-normal">Projetado</th>
        </tr>
      </thead>
      <tbody>
        {row("Patrimônio na aposentadoria", res.patrimonio, p.patrimonio, yRet, true)}
        {row("Você terá aportado", res.totalAportado, p.totalAportado, yRet)}
        {section(bridge ? `Renda mensal dos ${res.retirementAge} aos ${input.inssStartAge}` : "Renda mensal dos investimentos")}
        {row("Vivendo só dos juros", res.rendaJuros, p.rendaJuros, yRet)}
        {row(`Consumindo até ${input.horizonAge}`, res.rendaConsumo, p.rendaConsumo, yRet)}
        {section(`Renda mensal a partir dos ${input.inssStartAge} (com INSS)`)}
        {row("INSS", res.inss, p.inss, yInss)}
        {row("Total só dos juros", res.rendaJuros + res.inss, p.totalJuros, yInss, true)}
        {row(`Total consumindo até ${input.horizonAge}`, res.rendaConsumo + res.inss, p.totalConsumo, yInss, true)}
      </tbody>
    </table>
  );
}

/** Destaque: a renda mensal total a partir do INSS; abaixo, as variações e o detalhamento. */
export function ResultCard({ res, input, color }: { res: SimpleResult; input: SimpleInput; color: string }) {
  const bridge = res.retirementAge < input.inssStartAge;
  const yInss = thisYear() + Math.round(res.anosAteInss);
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          Aposentar aos {res.retirementAge}
        </h2>
        <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs text-muted tabular-nums">{compact(res.patrimonio)} acumulados</span>
      </div>

      <p className="mt-4 text-xs text-muted">Renda mensal a partir dos {input.inssStartAge}, com INSS</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{formatBRL0(res.rendaConsumo + res.inss)}</p>
      <p className="mt-1 text-xs text-muted tabular-nums">
        consumindo o patrimônio até {input.horizonAge} · {formatBRL0(res.projetado.totalConsumo)} em {yInss}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-subtle p-3">
          <dt className="text-xs text-muted">Só dos juros</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatBRL0(res.rendaJuros + res.inss)}</dd>
          <dd className="text-[11px] text-muted">patrimônio fica intacto</dd>
        </div>
        <div className="rounded-xl bg-subtle p-3">
          <dt className="text-xs text-muted">{bridge ? `Dos ${res.retirementAge} aos ${input.inssStartAge}` : "Sem o INSS"}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatBRL0(res.rendaConsumo)}</dd>
          <dd className="text-[11px] text-muted">{bridge ? "antes do INSS" : "só os investimentos"}</dd>
        </div>
      </dl>

      <details className="group mt-4 border-t border-line pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-accent">
          Ver detalhes em R$ de hoje e projetado
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition group-open:rotate-180" fill="currentColor" aria-hidden><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
        </summary>
        <div className="mt-2"><DetailTable res={res} input={input} /></div>
      </details>
    </Card>
  );
}

export function WealthChart({ input, ages }: { input: SimpleInput; ages: number[] }) {
  const [nominal, setNominal] = useState(false);
  const chart = useMemo(() => wealthByAge(input, ages, nominal), [input, ages, nominal]);
  const ticks = useMemo(() => {
    const first = chart[0]?.age ?? 0;
    const last = chart.at(-1)?.age ?? first;
    const t = [first];
    for (let a = Math.ceil((first + 1) / 5) * 5; a < last; a += 5) t.push(a);
    return [...t, last];
  }, [chart]);
  const axis = { fill: "#8b9391", fontSize: 12 };
  return (
    <Card
      title="Evolução do patrimônio"
      action={
        <span role="group" aria-label="Moeda do gráfico" className="inline-flex rounded-lg bg-subtle p-0.5 text-xs">
          {[false, true].map((n) => (
            <button key={String(n)} type="button" aria-pressed={nominal === n} onClick={() => setNominal(n)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${nominal === n ? "bg-surface shadow-sm" : "text-muted hover:text-fg"}`}>
              {n ? "Projetado" : "R$ de hoje"}
            </button>
          ))}
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
        {ages.map((a, i) => (
          <span key={a} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />Aposentando aos {a}</span>
        ))}
        <span>Consumindo até {input.horizonAge} anos</span>
      </div>
      <div className="h-72 w-full" data-testid="chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart} margin={{ left: 0, right: 8, top: 16 }}>
            <defs>
              {ages.map((a, i) => (
                <linearGradient key={a} id={`fill${a}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="#8b9391" strokeOpacity={0.2} />
            <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} ticks={ticks} tick={axis} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v: number) => `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`} width={52} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v, name) => [formatBRL0(Number(v)), String(name)]}
              labelFormatter={(l) => `Aos ${l} anos`}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "var(--muted)" }}
            />
            {ages.map((age, i) => (
              <Area key={age} type="monotone" dataKey={`a${age}`} name={`Aposentando aos ${age}`}
                stroke={COLORS[i % COLORS.length]} fill={`url(#fill${age})`} strokeWidth={2} isAnimationActive={false} />
            ))}
            <ReferenceLine x={input.inssStartAge} stroke="#10b981" strokeDasharray="3 4"
              label={{ value: "INSS", position: "insideTopRight", fontSize: 11, fill: "#10b981" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Cartões 60 × 65 + gráfico. */
export function RetirementResults({ input }: { input: SimpleInput }) {
  const results = useResults(input);
  const ages = useMemo(() => results.map((r) => r.retirementAge), [results]);
  if (results.length === 0) return <Card><p className="text-sm text-muted">Sua idade atual já passou de 65 anos.</p></Card>;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2" data-testid="kpis">
        {results.map((r, i) => <ResultCard key={r.retirementAge} res={r} input={input} color={COLORS[i % COLORS.length]!} />)}
      </div>
      <WealthChart input={input} ages={ages} />
    </>
  );
}
