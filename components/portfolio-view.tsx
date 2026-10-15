"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveAccountsAction, saveContributionAction, saveExtrasAction, savePausesAction } from "@/app/carteira/actions";
import { ListEditor, type Col } from "@/components/list-editor";
import { Button, Card, inputCls } from "@/components/ui";
import { formatBRL, formatPercent } from "@/lib/format";
import { allocationRows, weightedReturns } from "@/lib/portfolio";
import type { ExtraForm, PauseForm, PlanData, PlanForm } from "@/lib/plan";

type AccountRow = PlanForm["accounts"][number];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((l, i) => ({ value: String(i + 1), label: l }));

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function ContributionCard({ plan }: { plan: PlanData }) {
  const router = useRouter();
  const rows = useMemo(() => allocationRows(plan), [plan]);
  const [monthly, setMonthly] = useState(plan.contribution.monthly);
  const [growth, setGrowth] = useState(plan.contribution.realGrowth);
  const [target, setTarget] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.classId, r.target])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const sum = Object.values(target).reduce((s, v) => s + v, 0);
  const valid = Math.abs(sum - 1) < 0.0005;

  const save = () =>
    start(async () => {
      // normaliza resíduo de arredondamento para a soma ser exatamente 1
      const entries = Object.entries(target).filter(([, v]) => v > 0);
      const alloc: Record<string, number> = {};
      entries.forEach(([id, v]) => (alloc[id] = v / sum));
      const r = await saveContributionAction({ monthly, realGrowth: growth, allocation: alloc });
      setMsg(r.ok ? { ok: true, text: "Salvo." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <Card title="Aportes e alocação alvo">
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1 block font-medium">Aporte mensal (R$)</span>
          <input className={inputCls} type="number" step="0.01" min={0} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Reajuste real anual (%)</span>
          <input className={inputCls} type="number" step="0.1" value={Number((growth * 100).toFixed(4))} onChange={(e) => setGrowth(Number(e.target.value) / 100)} /></label>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-zinc-500"><th className="pb-1">Classe</th><th>Saldo</th><th>Atual</th><th className="w-40">Alvo (%)</th><th>Desvio</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.classId} className="border-t border-zinc-100 align-middle">
              <td className="py-2">{r.name}</td>
              <td className="tabular-nums">{formatBRL(r.balance)}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded bg-zinc-100"><div className="h-2 rounded bg-zinc-700" style={{ width: `${Math.min(100, r.current * 100)}%` }} /></div>
                  <span className="tabular-nums">{formatPercent(r.current)}</span>
                </div>
              </td>
              <td>
                <input aria-label={`Alvo ${r.name}`} className={inputCls} type="number" min={0} max={100} step="0.5"
                  value={Number(((target[r.classId] ?? 0) * 100).toFixed(2))}
                  onChange={(e) => setTarget((t) => ({ ...t, [r.classId]: Number(e.target.value) / 100 }))} />
              </td>
              <td className={`tabular-nums ${Math.abs(r.current - (target[r.classId] ?? 0)) > 0.05 ? "text-amber-700" : "text-zinc-500"}`}>
                {((r.current - (target[r.classId] ?? 0)) * 100).toLocaleString("pt-BR", { signDisplay: "exceptZero", maximumFractionDigits: 1 })} p.p.
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mt-2 text-sm ${valid ? "text-zinc-600" : "text-red-600"}`}>
        Soma do alvo: {formatPercent(sum)} {valid ? "" : "— deve ser 100%"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" type="button" onClick={() => setTarget(Object.fromEntries(rows.map((r) => [r.classId, r.current])))}>Usar alocação atual</Button>
        <Button type="button" onClick={save} disabled={pending || !valid}>{pending ? "Salvando…" : "Salvar"}</Button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </Card>
  );
}

export function PortfolioView({ plan }: { plan: PlanData }) {
  const classOptions = plan.classes.map((c) => ({ value: c.id, label: c.name }));
  const included = plan.accounts.filter((a) => a.included);
  const total = included.reduce((s, a) => s + a.balance, 0);
  const excluded = plan.accounts.filter((a) => !a.included).reduce((s, a) => s + a.balance, 0);
  const basis = included.reduce((s, a) => s + Math.min(a.costBasis, a.balance), 0);
  const wr = weightedReturns(plan);

  const accountCols: Col<AccountRow>[] = [
    { key: "name", label: "Nome", type: "text" },
    { key: "classId", label: "Classe", type: "select", options: classOptions },
    { key: "institution", label: "Instituição", type: "optText" },
    { key: "balance", label: "Saldo (R$)", type: "number", step: "0.01" },
    { key: "costBasis", label: "Custo base (R$)", type: "number", step: "0.01", hint: "Valor investido; define o IR sobre o ganho" },
    { key: "included", label: "Entra na aposentadoria", type: "checkbox" },
  ];
  const extraCols: Col<ExtraForm>[] = [
    { key: "description", label: "Descrição", type: "optText" },
    { key: "amount", label: "Valor (R$)", type: "number", step: "0.01" },
    { key: "month", label: "Mês", type: "select", options: MONTHS, get: (r) => String(r.month), set: (r, v) => ({ ...r, month: Number(v) }) },
    { key: "yearly", label: "Todo ano", type: "checkbox", set: (r, v) => ({ ...r, yearly: Boolean(v), year: v ? null : r.year ?? new Date().getFullYear() }) },
    { key: "year", label: "Ano (se único)", type: "optNumber" },
  ];
  const pauseCols: Col<PauseForm>[] = [
    { key: "from", label: "De", type: "month" },
    { key: "to", label: "Até", type: "month" },
    { key: "reason", label: "Motivo", type: "optText" },
  ];
  const ym = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Carteira</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="portfolio-stats">
        <Stat label="Na aposentadoria" value={formatBRL(total)} sub={excluded > 0 ? `+ ${formatBRL(excluded)} fora do plano` : undefined} />
        <Stat label="Ganho não realizado" value={formatBRL(total - basis)} sub="base do IR no resgate" />
        <Stat label="Retorno real ponderado (base)" value={formatPercent(wr.base)} sub="líquido de custos, a.a." />
        <Stat label="Pessimista / otimista" value={`${formatPercent(wr.pessimista)} / ${formatPercent(wr.otimista)}`} />
      </div>
      <ListEditor<AccountRow>
        title="Contas"
        description="Desmarque “Entra na aposentadoria” para excluir a reserva de emergência do plano."
        columns={accountCols}
        initial={plan.accounts}
        blank={() => ({ name: "", classId: plan.classes[0]?.id ?? "", institution: null, balance: 0, costBasis: 0, included: true })}
        action={saveAccountsAction}
        emptyText="Nenhuma conta cadastrada."
      />
      <ContributionCard plan={plan} />
      <ListEditor<ExtraForm>
        title="Aportes extras"
        description="13º, participação nos lucros etc. Respeitam as pausas."
        columns={extraCols}
        initial={plan.extras}
        blank={() => ({ description: null, amount: 0, month: 12, year: null, yearly: true })}
        action={saveExtrasAction}
      />
      <ListEditor<PauseForm>
        title="Pausas de aporte"
        description="Períodos sem aporte (renda de freelancer é variável)."
        columns={pauseCols}
        initial={plan.pauses}
        blank={() => ({ from: ym, to: ym, reason: null })}
        action={savePausesAction}
      />
    </div>
  );
}
