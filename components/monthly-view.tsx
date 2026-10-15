"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { formatBRL0 } from "@/lib/format";
import { RETIREMENT_AGES, toSimpleInput, type PlanInput } from "@/lib/plan";
import { monthlySchedule, type IncomeMode, type MonthRow } from "@/lib/simulator";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtDate = (ym: string) => `${MONTHS[Number(ym.slice(5)) - 1]}/${ym.slice(0, 4)}`;
const fmtAge = (age: number) => {
  const total = Math.floor(age * 12 + 1e-9);
  const y = Math.floor(total / 12), m = total % 12;
  return m ? `${y}a ${m}m` : `${y} anos`;
};

function Segmented<T extends string | number | boolean>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs text-muted">{label}</div>
      <div role="group" aria-label={label} className="inline-flex rounded-lg bg-subtle p-0.5 text-sm">
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition ${value === o.value ? "bg-surface shadow-sm" : "text-muted hover:text-fg"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const num = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

function toCsv(rows: MonthRow[], nominal: boolean): string {
  const k = (r: MonthRow) => (nominal ? r.fator : 1);
  const head = ["Mês", "Idade", "Fase", "Saldo inicial", "Aporte", "Saque", "Juros", "INSS", "Renda do mês", "Saldo final"];
  const lines = rows.map((r) => [
    r.date, fmtAge(r.age), r.phase === "acumulacao" ? "Acumulação" : "Aposentadoria",
    num(r.saldoInicial * k(r)), num(r.aporte * k(r)), num(r.saque * k(r)), num(r.juros * k(r)),
    num(r.inss * k(r)), num(r.renda * k(r)), num(r.saldoFinal * k(r)),
  ].join(";"));
  return "﻿" + [head.join(";"), ...lines].join("\n");
}

export function MonthlyView({ plan, simHref = "/simulador" }: { plan: PlanInput | null; simHref?: string }) {
  const input = useMemo(() => (plan ? toSimpleInput(plan) : null), [plan]);
  const ages = useMemo(() => RETIREMENT_AGES.filter((a) => input && a > input.currentAge), [input]);
  const [age, setAge] = useState<number>(ages.at(-1) ?? 65);
  const [mode, setMode] = useState<IncomeMode>("consumo");
  const [nominal, setNominal] = useState(false);
  const rows = useMemo(() => (input ? monthlySchedule(input, age, mode) : []), [input, age, mode]);

  if (!plan || !input) {
    return (
      <Card className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-xl font-semibold">Mês a mês</h1>
        <p className="mt-2 text-sm text-muted">Salve um plano no simulador para ver a projeção mês a mês.</p>
        <Link href={simHref} className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover">Abrir o simulador</Link>
      </Card>
    );
  }

  const v = (r: MonthRow, x: number) => formatBRL0(nominal ? x * r.fator : x);
  const download = () => {
    const blob = new Blob([toCsv(rows, nominal)], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `mes-a-mes-aposentadoria-${age}-${mode}-${nominal ? "projetado" : "hoje"}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const totals = rows.reduce((t, r) => ({
    aporte: t.aporte + (nominal ? r.aporte * r.fator : r.aporte),
    juros: t.juros + (nominal ? r.juros * r.fator : r.juros),
    renda: t.renda + (nominal ? r.renda * r.fator : r.renda),
  }), { aporte: 0, juros: 0, renda: 0 });
  const stat = (label: string, value: string) => (
    <div className="min-w-0"><div className="text-xs text-muted">{label}</div><div className="mt-0.5 truncate font-semibold tabular-nums">{value}</div></div>
  );
  const th = "sticky top-0 z-10 bg-surface px-3 py-2 text-right font-medium text-muted first:text-left";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mês a mês</h1>
          <p className="mt-1 text-sm text-muted">Cada mês do seu plano, de hoje até os {input.horizonAge} anos.</p>
        </div>
        <Button variant="ghost" onClick={download}>Exportar CSV</Button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Segmented label="Aposentar aos" value={age} onChange={setAge} options={ages.map((a) => ({ value: a, label: `${a} anos` }))} />
          <Segmented label="Renda" value={mode} onChange={setMode}
            options={[{ value: "consumo", label: `Consumindo até ${input.horizonAge}` }, { value: "juros", label: "Só dos juros" }]} />
          <Segmented label="Valores" value={nominal} onChange={setNominal}
            options={[{ value: false, label: "R$ de hoje" }, { value: true, label: "Projetado" }]} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
          {stat("Meses", `${rows.length}`)}
          {stat(`Aportes até os ${age}`, formatBRL0(totals.aporte))}
          {stat("Juros no período", formatBRL0(totals.juros))}
          {stat("Renda recebida", formatBRL0(totals.renda))}
        </div>
      </Card>

      <Card className="p-0">
        <div className="max-h-[70vh] overflow-auto rounded-2xl" data-testid="monthly-table">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={`${th} left-0 z-20`}>Mês</th>
                <th className={th}>Idade</th>
                <th className={th}>Saldo inicial</th>
                <th className={th}>Aporte</th>
                <th className={th}>Saque</th>
                <th className={th}>Juros</th>
                <th className={th}>INSS</th>
                <th className={th}>Renda do mês</th>
                <th className={th}>Saldo final</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r, i) => {
                const prev = rows[i - 1];
                const retires = !!prev && prev.phase !== r.phase;
                const inssStarts = !!prev && prev.inss === 0 && r.inss > 0;
                const marker = retires && inssStarts ? `Aposentadoria e início do INSS aos ${age}`
                  : retires ? `Aposentadoria aos ${age}`
                  : inssStarts ? `Início do INSS aos ${input.inssStartAge}`
                  : null;
                const dim = (x: number) => (x === 0 ? "text-muted/50" : "");
                return [
                  marker && (
                    <tr key={`m${r.month}`} className="bg-accent-soft">
                      <td colSpan={9} className="px-3 py-1.5 text-xs font-semibold text-accent"><span className="sticky left-3">{marker}</span></td>
                    </tr>
                  ),
                  <tr key={r.month} className={`border-t border-line ${r.date.endsWith("-01") ? "border-t-fg/20" : ""} ${r.phase === "aposentadoria" ? "" : "bg-subtle/40"}`}>
                    <td className="sticky left-0 bg-surface px-3 py-1.5 text-left whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted">{fmtAge(r.age)}</td>
                    <td className="px-3 py-1.5 text-right">{v(r, r.saldoInicial)}</td>
                    <td className={`px-3 py-1.5 text-right ${dim(r.aporte)}`}>{v(r, r.aporte)}</td>
                    <td className={`px-3 py-1.5 text-right ${dim(r.saque)}`}>{v(r, r.saque)}</td>
                    <td className="px-3 py-1.5 text-right text-good">{v(r, r.juros)}</td>
                    <td className={`px-3 py-1.5 text-right ${dim(r.inss)}`}>{v(r, r.inss)}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${dim(r.renda)}`}>{v(r, r.renda)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{v(r, r.saldoFinal)}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted">
        Aporte no fim do mês e saque no início. <strong className="font-medium">R$ de hoje</strong>: poder de compra atual.
        <strong className="font-medium"> Projetado</strong>: valor nominal de cada mês, corrigido pela inflação de {(input.inflation * 100).toLocaleString("pt-BR")}% a.a.
      </p>
    </div>
  );
}
