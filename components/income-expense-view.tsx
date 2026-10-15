"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveExpensesAction, saveIncomesAction, saveInssAction } from "@/app/renda-gastos/actions";
import { ListEditor, type Col } from "@/components/list-editor";
import { Button, Card, inputCls } from "@/components/ui";
import { estimateInssBenefit } from "@/lib/engine";
import { formatBRL, formatPercent } from "@/lib/format";
import { currentAge, type IncomeForm, type PlanData, type PlanForm } from "@/lib/plan";

type ExpenseRow = PlanForm["expenses"][number];

const INCOME_TYPES = [
  { value: "aluguel", label: "Aluguel" },
  { value: "trabalho_parcial", label: "Trabalho parcial" },
  { value: "renda_mais", label: "Renda+" },
  { value: "outro", label: "Outro" },
];
const CATEGORIES = [
  { value: "essencial", label: "Essencial" },
  { value: "discricionario", label: "Discricionário" },
  { value: "saude", label: "Saúde" },
];

function Num({ label, value, onChange, step = "any", hint }: { label: string; value: number; onChange: (v: number) => void; step?: string; hint?: string }) {
  return (
    <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>
      <input className={inputCls} type="number" step={step} value={value} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function InssCard({ plan }: { plan: PlanData }) {
  const router = useRouter();
  const [f, setF] = useState(plan.inss);
  const [inc, setInc] = useState(plan.inssIncrease ?? { enabled: false, newContributionSalary: plan.inssParams.minimumWage * 2, from: plan.startDate });
  const [baseYears, setBaseYears] = useState(20);
  const [stopAge, setStopAge] = useState(plan.targetAges[0] ?? 60);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const age = currentAge(plan);

  const est = useMemo(() => {
    const common = {
      contributionYearsSoFar: f.contributionYears, historicalAverageSalary: f.contributionSalary,
      currentContributionSalary: f.contributionSalary, startDate: plan.startDate, stopContributingAge: stopAge,
      ageAtStartYears: age, minimumWage: plan.inssParams.minimumWage, ceiling: plan.inssParams.ceiling, baseYears,
    };
    return {
      without: estimateInssBenefit(common),
      with: estimateInssBenefit({ ...common, increase: { newContributionSalary: inc.newContributionSalary, from: inc.from } }),
    };
  }, [f, inc, stopAge, baseYears, plan, age]);

  const save = () =>
    start(async () => {
      const r = await saveInssAction({ ...f, increase: inc });
      setMsg(r.ok ? { ok: true, text: "Salvo." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <Card title="INSS">
      <p className="mb-3 text-sm text-zinc-600">
        Aposentadoria por idade: 65 anos + 15 de contribuição. Aposentando antes do início do benefício, a carteira cobre a “ponte”.
        O benefício vem do Meu INSS (campo manual) ou, se o cenário abaixo estiver ativo, da aproximação.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Num label="Benefício estimado (R$/mês)" value={f.benefit} step="0.01" onChange={(v) => setF({ ...f, benefit: v })} hint="Preencha a partir do Meu INSS" />
        <Num label="Idade de início do benefício" value={f.startAge} onChange={(v) => setF({ ...f, startAge: v })} />
        <Num label="Crescimento real do salário mínimo (%)" value={Number((f.realGrowth * 100).toFixed(4))} step="0.1" onChange={(v) => setF({ ...f, realGrowth: v / 100 })} />
        <Num label="Anos de contribuição hoje" value={f.contributionYears} step="0.1" onChange={(v) => setF({ ...f, contributionYears: v })} />
        <Num label="Salário de contribuição atual (R$)" value={f.contributionSalary} step="0.01" onChange={(v) => setF({ ...f, contributionSalary: v })} />
      </div>

      <div className="mt-5 rounded-lg border border-zinc-200 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={inc.enabled} onChange={(e) => setInc({ ...inc, enabled: e.target.checked })} />
          Cenário: aumentar a contribuição ao INSS
        </label>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <Num label="Novo salário de contribuição (R$)" value={inc.newContributionSalary} step="0.01" onChange={(v) => setInc({ ...inc, newContributionSalary: v })} />
          <label className="block text-sm"><span className="mb-1 block font-medium">A partir de</span>
            <input className={inputCls} type="month" value={inc.from} onChange={(e) => setInc({ ...inc, from: e.target.value })} /></label>
          <Num label="Parar de contribuir aos (anos)" value={stopAge} onChange={setStopAge} hint="Estimativa de prévia" />
          <label className="block text-sm"><span className="mb-1 block font-medium">Regra dos +2%</span>
            <select className={inputCls} value={baseYears} onChange={(e) => setBaseYears(Number(e.target.value))}>
              <option value={20}>Acima de 20 anos (homens)</option>
              <option value={15}>Acima de 15 anos (mulheres)</option>
            </select></label>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2" data-testid="inss-estimate">
          <div><dt className="text-zinc-500">Sem aumento</dt><dd className="font-semibold">{formatBRL(est.without.benefit)}</dd></div>
          <div><dt className="text-zinc-500">Com aumento</dt>
            <dd className="font-semibold">{formatBRL(est.with.benefit)} <span className="font-normal text-zinc-500">
              (média {formatBRL(est.with.averageSalary)} × {formatPercent(est.with.coefficient)}{est.with.clampedBy ? `, limitado ao ${est.with.clampedBy}` : ""})</span></dd></div>
        </dl>
        <p className="mt-2 text-xs text-amber-800">{est.with.warning} Contribuir mais também custa mais: ajuste o aporte à carteira.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </Card>
  );
}

export function IncomeExpenseView({ plan }: { plan: PlanData }) {
  const incomeCols: Col<IncomeForm>[] = [
    { key: "type", label: "Tipo", type: "select", options: INCOME_TYPES },
    { key: "description", label: "Descrição", type: "optText" },
    { key: "monthly", label: "R$/mês (hoje)", type: "number", step: "0.01" },
    { key: "startAge", label: "Idade início", type: "number" },
    { key: "endAge", label: "Idade fim", type: "optNumber", hint: "Vazio = vitalício" },
    { key: "realGrowth", label: "Cresc. real (% a.a.)", type: "percent" },
    { key: "taxable", label: "Tributável", type: "checkbox" },
  ];
  const expenseCols: Col<ExpenseRow>[] = [
    { key: "category", label: "Categoria", type: "select", options: CATEGORIES },
    { key: "monthly", label: "R$/mês (hoje)", type: "number", step: "0.01" },
    { key: "startAge", label: "Idade início", type: "number" },
    { key: "endAge", label: "Idade fim", type: "optNumber", hint: "Vazio = vitalício" },
    { key: "extraInflation", label: "Inflação extra (% a.a.)", type: "percent", hint: "Saúde: +3% acima do IPCA" },
    {
      key: "stepFrom", label: "Degrau: a partir de (idade)", type: "optNumber", hint: "Ex.: 75",
      get: (r) => r.ageSteps[0]?.fromAge ?? null,
      set: (r, v) => ({ ...r, ageSteps: v === null ? [] : [{ fromAge: Number(v), factor: r.ageSteps[0]?.factor ?? 0.8 }] }),
    },
    {
      key: "stepFactor", label: "Degrau: gasto passa a (%)", type: "number", hint: "80 = cai 20%",
      get: (r) => (r.ageSteps[0]?.factor ?? 1) * 100,
      set: (r, v) => ({ ...r, ageSteps: r.ageSteps[0] ? [{ fromAge: r.ageSteps[0].fromAge, factor: Number(v) / 100 }] : r.ageSteps }),
    },
  ];
  const total = plan.expenses.reduce((s, e) => s + e.monthly, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Renda e gastos</h1>
      <InssCard plan={plan} />
      <ListEditor<IncomeForm>
        title="Outras rendas na aposentadoria"
        description="Valores mensais em R$ de hoje. O INSS é configurado acima."
        columns={incomeCols}
        initial={plan.otherIncomes}
        blank={() => ({ type: "aluguel", description: null, monthly: 0, startAge: 60, endAge: null, realGrowth: 0, taxable: false })}
        action={saveIncomesAction}
      />
      <ListEditor<ExpenseRow>
        title={`Metas de gasto (renda desejada) — total ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês`}
        description="Por categoria e faixa etária. Use o degrau para reduzir o gasto após certa idade (ex.: discricionário cai 20% após os 75)."
        columns={expenseCols}
        initial={plan.expenses}
        blank={() => ({ category: "discricionario", monthly: 0, startAge: 60, endAge: null, extraInflation: 0, ageSteps: [] })}
        action={saveExpensesAction}
      />
    </div>
  );
}
