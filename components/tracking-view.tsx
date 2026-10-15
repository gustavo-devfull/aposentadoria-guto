"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { deleteSnapshotAction, saveSnapshotAction, setReferenceAction } from "@/app/acompanhamento/actions";
import { Button, Card, inputCls } from "@/components/ui";
import { formatBRL, formatPercent } from "@/lib/format";
import type { SnapshotInput, TrackingResult } from "@/lib/tracking";

export interface TrackingAccount { id: string; name: string; balance: number; included: boolean }
export interface SimOption { id: string; nome: string; retirementAge: number }

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

export function TrackingView({
  accounts, snapshots, tracking, simulations, referenceId, referenceName, canSave = true,
}: {
  accounts: TrackingAccount[]; snapshots: SnapshotInput[]; tracking: TrackingResult | null;
  simulations: SimOption[]; referenceId: string | null; referenceName: string | null; canSave?: boolean;
}) {
  const router = useRouter();
  const now = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(now);
  const byMonth = useMemo(() => new Map(snapshots.map((s) => [ym(s.year, s.month), s])), [snapshots]);
  const prefill = (key: string) => {
    const s = byMonth.get(key);
    return {
      balances: Object.fromEntries(accounts.map((a) => [a.id, s?.balances[a.id] ?? a.balance])),
      contribution: s?.contribution ?? 0,
      note: s?.note ?? "",
    };
  };
  const [form, setForm] = useState(() => prefill(now));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pickMonth = (key: string) => { setMonth(key); setForm(prefill(key)); setMsg(null); };
  const save = () =>
    start(async () => {
      const [y, m] = month.split("-").map(Number);
      const r = await saveSnapshotAction({ year: y, month: m, balances: form.balances, contribution: form.contribution, note: form.note || null });
      setMsg(r.ok ? { ok: true, text: "Lançamento salvo." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  const chooseRef = (id: string | null) => start(async () => { await setReferenceAction(id); router.refresh(); });

  const chart = useMemo(() => {
    if (!tracking) return [];
    const realized = new Map(tracking.rows.map((r) => [r.key, r.realized]));
    const last = tracking.rows.at(-1)?.key;
    const keys = tracking.projectedSeries.map((p) => p.key);
    const lastIdx = last ? keys.indexOf(last) : -1;
    const end = lastIdx >= 0 ? Math.min(keys.length, lastIdx + 25) : Math.min(keys.length, 25);
    return tracking.projectedSeries.slice(0, end).map((p) => ({ key: p.key, projetado: Math.round(p.projected), realizado: realized.get(p.key) }));
  }, [tracking]);

  const latest = tracking?.latest;
  const total = Object.values(form.balances).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Acompanhamento</h1>

      <Card title="Plano de referência">
        {simulations.length === 0 ? (
          <p className="text-sm text-zinc-600">Salve uma simulação no Simulador para usá-la como plano de referência.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select aria-label="Simulação de referência" className={`${inputCls} !w-auto min-w-[16rem]`} value={referenceId ?? ""}
              onChange={(e) => chooseRef(e.target.value || null)} disabled={pending}>
              <option value="">Selecione…</option>
              {simulations.map((s) => <option key={s.id} value={s.id}>{s.nome} (aos {s.retirementAge})</option>)}
            </select>
            {referenceName && <span className="text-zinc-600">Comparando com “{referenceName}”, em valores nominais.</span>}
          </div>
        )}
      </Card>

      {latest && (
        <div role={tracking!.alert ? "alert" : "status"} data-testid="tracking-banner"
          className={`rounded-lg border p-4 text-sm ${tracking!.alert ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}>
          {tracking!.alert ? (
            <><strong>Atenção:</strong> em {latest.key} o patrimônio realizado ({formatBRL(latest.realized)}) está {formatPercent(Math.abs(latest.deviationPct))} abaixo do plano ({formatBRL(latest.projected)}), mais que o limite de {formatPercent(tracking!.threshold)}.</>
          ) : (
            <>Em {latest.key} o realizado ({formatBRL(latest.realized)}) está {latest.deviation >= 0 ? "acima" : "abaixo"} do plano em {formatBRL(Math.abs(latest.deviation))} ({formatPercent(Math.abs(latest.deviationPct))}) — dentro do limite.</>
          )}
          <div className="mt-1 text-xs opacity-80">
            Aportes acumulados: realizado {formatBRL(latest.contributionRealizedCum)} vs planejado {formatBRL(latest.contributionProjectedCum)}.
          </div>
        </div>
      )}

      <Card title="Lançamento mensal">
        <div className="mb-3 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm"><span className="mb-1 block font-medium">Mês</span>
            <input className={inputCls} type="month" value={month} onChange={(e) => pickMonth(e.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">Aporte realizado (R$)</span>
            <input className={inputCls} type="number" step="0.01" min={0} value={form.contribution} onChange={(e) => setForm({ ...form, contribution: Number(e.target.value) })} /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">Nota</span>
            <input className={inputCls} value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        {accounts.length === 0 ? <p className="text-sm text-zinc-600">Cadastre contas na Carteira primeiro.</p> : (
          <div className="grid gap-3 sm:grid-cols-3">
            {accounts.map((a) => (
              <label key={a.id} className="block text-sm">
                <span className="mb-1 block font-medium">{a.name}{!a.included && <span className="font-normal text-zinc-500"> (fora do plano)</span>}</span>
                <input aria-label={`Saldo ${a.name}`} className={inputCls} type="number" step="0.01" min={0} value={form.balances[a.id] ?? 0}
                  onChange={(e) => setForm({ ...form, balances: { ...form.balances, [a.id]: Number(e.target.value) } })} />
              </label>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={pending || accounts.length === 0 || !canSave}>{byMonth.has(month) ? "Atualizar lançamento" : "Salvar lançamento"}</Button>
          <span className="text-sm text-zinc-500">Total informado: {formatBRL(total)}</span>
          {msg && <span role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </Card>

      {tracking && (
        <Card title="Realizado vs projetado (R$ nominais)">
          <div className="h-80 w-full" data-testid="tracking-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ left: 8, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="key" minTickGap={32} />
                <YAxis width={64} tickFormatter={(v: number) => `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="projetado" name="Projetado" stroke="#2563eb" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="realizado" name="Realizado" stroke="#ea580c" strokeWidth={2} connectNulls dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="Lançamentos">
        {!tracking || tracking.rows.length === 0 ? <p className="text-sm text-zinc-500">{tracking ? "Nenhum lançamento dentro do período da simulação." : "Escolha um plano de referência para ver os desvios."}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="tracking-table">
              <thead><tr className="text-left text-xs text-zinc-500"><th>Mês</th><th>Realizado</th><th>Projetado</th><th>Desvio</th><th>%</th><th>Nota</th><th /></tr></thead>
              <tbody>
                {[...tracking.rows].reverse().map((r) => (
                  <tr key={r.key} className={`border-t border-zinc-100 ${r.below ? "bg-red-50" : ""}`}>
                    <td className="py-1.5">{r.key}</td>
                    <td className="tabular-nums">{formatBRL(r.realized)}</td>
                    <td className="tabular-nums">{formatBRL(r.projected)}</td>
                    <td className={`tabular-nums ${r.deviation < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatBRL(r.deviation)}</td>
                    <td className="tabular-nums">{(r.deviationPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" })}%</td>
                    <td className="text-zinc-600">{r.note}</td>
                    <td><Button variant="ghost" type="button" aria-label={`Excluir ${r.key}`} disabled={!canSave}
                      onClick={() => start(async () => { await deleteSnapshotAction(r.year, r.month); router.refresh(); })}>Excluir</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
