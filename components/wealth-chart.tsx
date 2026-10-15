"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui";
import type { SimulationResult } from "@/lib/engine";
import { formatBRL } from "@/lib/format";

const COLORS = ["#2563eb", "#ea580c", "#16a34a"];

export function WealthChart({
  results, nominal, inssStartAge, title,
}: { results: { age: number; res: SimulationResult }[]; nominal: boolean; inssStartAge: number; title?: string }) {
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
    <Card title={title ?? `Evolução do patrimônio (${nominal ? "nominal" : "R$ de hoje"})`}>
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
                stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} isAnimationActive={false} />
            ))}
            {results.map(({ age }) => (
              <ReferenceLine key={`r${age}`} x={age} stroke="#52525b" strokeDasharray="4 4"
                label={{ value: `Apos. ${age}`, position: "top", fontSize: 11 }} />
            ))}
            <ReferenceLine x={inssStartAge} stroke="#16a34a" strokeDasharray="2 4"
              label={{ value: "INSS", position: "insideBottomRight", fontSize: 11, fill: "#16a34a" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
