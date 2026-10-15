"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RetirementResults } from "@/components/retirement-results";
import { Card } from "@/components/ui";
import { formatBRL0, formatPercent } from "@/lib/format";
import { toSimpleInput, type PlanInput } from "@/lib/plan";

const linkBtn = "inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition";

export function Dashboard({ plan, editHref = "/simulador", monthlyHref = "/mes-a-mes" }: { plan: PlanInput | null; editHref?: string; monthlyHref?: string }) {
  const input = useMemo(() => (plan ? toSimpleInput(plan) : null), [plan]);

  if (!plan || !input) {
    return (
      <Card className="mx-auto max-w-lg py-10 text-center">
        <h1 className="text-xl font-semibold">Monte seu plano</h1>
        <p className="mt-2 text-sm text-muted">Informe quanto tem investido, quanto aporta e a taxa. Em um minuto você vê sua renda aos 60 e aos 65.</p>
        <Link href={editHref} className={`${linkBtn} mt-6 bg-accent text-accent-fg hover:bg-accent-hover`}>Abrir o simulador</Link>
      </Card>
    );
  }

  const item = (label: string, value: string) => (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 truncate font-semibold tabular-nums">{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meu plano</h1>
          <p className="mt-1 text-sm text-muted">Sua renda mensal se aposentar aos 60 ou aos 65.</p>
        </div>
        <div className="flex gap-2">
          <Link href={monthlyHref} className={`${linkBtn} border border-line bg-surface hover:bg-subtle`}>Ver mês a mês</Link>
          <Link href={editHref} className={`${linkBtn} border border-line bg-surface hover:bg-subtle`}>Ajustar no simulador</Link>
        </div>
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" data-testid="plan-summary">
          {item("Idade", `${input.currentAge} anos`)}
          {item("Investido hoje", formatBRL0(plan.invested))}
          {item("Aporte mensal", formatBRL0(plan.monthly))}
          {item("Taxa de juros", `${formatPercent(plan.annualRate)} a.a.`)}
          {item("Inflação", `${formatPercent(plan.inflation)} a.a.`)}
          {item(`INSS aos ${plan.inssStartAge}`, formatBRL0(plan.inssBenefit))}
        </div>
      </Card>
      <RetirementResults input={input} />
      <p className="text-xs text-muted">
        <strong className="font-medium">R$ de hoje</strong>: poder de compra atual. <strong className="font-medium">Projetado</strong>: o valor nominal naquele ano, corrigido pela inflação informada.
      </p>
    </div>
  );
}
