"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createVersionAction } from "@/app/premissas/actions";
import { Button, Card, inputCls } from "@/components/ui";
import { diffVersions, type AssumptionInput, type AssumptionVersion } from "@/lib/assumptions";
import { formatBRL, formatDate, formatPercent } from "@/lib/format";

const pctInput = (v: number) => Number((v * 100).toFixed(4));

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}</label>
  );
}

export function AssumptionsView({ versions }: { versions: AssumptionVersion[] }) {
  const router = useRouter();
  const latest = versions[0]!;
  const [f, setF] = useState<AssumptionInput>(() => ({ ...latest, classes: latest.classes.map((c) => ({ ...c })) }));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [aVer, setAVer] = useState(versions[1]?.versao ?? latest.versao);
  const [bVer, setBVer] = useState(latest.versao);

  const set = <K extends keyof AssumptionInput>(k: K, v: AssumptionInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const setClass = (id: string, patch: Partial<AssumptionInput["classes"][number]>) =>
    setF((s) => ({ ...s, classes: s.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const changes = useMemo(() => diffVersions(latest, f).length, [latest, f]);

  const diff = useMemo(() => {
    const a = versions.find((v) => v.versao === aVer);
    const b = versions.find((v) => v.versao === bVer);
    return a && b ? diffVersions(a, b) : [];
  }, [versions, aVer, bVer]);

  const save = () =>
    start(async () => {
      const r = await createVersionAction(f);
      setMsg(r.ok ? { ok: true, text: `Versão ${latest.versao + 1} criada.` } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  const pctField = (label: string, value: number, onChange: (v: number) => void, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} type="number" step="0.1" value={pctInput(value)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
    </Field>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Premissas</h1>
      <p className="text-sm text-zinc-600">
        Versão atual: <strong>v{latest.versao}</strong> ({formatDate(latest.createdAt)}). Cada alteração cria uma nova versão; as anteriores nunca são sobrescritas.
      </p>

      <Card title="Nova versão a partir da atual">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome"><input className={inputCls} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
          {pctField("Inflação de longo prazo (% a.a.)", f.inflation, (v) => set("inflation", v), "Referência: Boletim Focus (Banco Central). Atualize periodicamente.")}
          <Field label="Cenário">
            <select className={inputCls} value={f.scenario} onChange={(e) => set("scenario", e.target.value as AssumptionInput["scenario"])}>
              <option value="pessimista">Pessimista</option><option value="base">Base</option><option value="otimista">Otimista</option>
            </select></Field>
          <Field label="Método de retirada">
            <select className={inputCls} value={f.method} onChange={(e) => set("method", e.target.value as AssumptionInput["method"])}>
              <option value="preservar_capital">Preservar capital</option><option value="consumir_ate_horizonte">Consumir até o horizonte</option><option value="taxa_fixa">Taxa de retirada fixa</option>
            </select></Field>
          {pctField("Taxa de retirada fixa (% a.a.)", f.fixedWithdrawalRate ?? 0.04, (v) => set("fixedWithdrawalRate", v))}
          <Field label="Ordem de resgate">
            <select className={inputCls} value={f.redemptionOrder} onChange={(e) => set("redemptionOrder", e.target.value as AssumptionInput["redemptionOrder"])}>
              <option value="proporcional">Proporcional à carteira</option><option value="menor_ir_primeiro">Menor IR primeiro</option>
            </select></Field>
          <Field label="Salário mínimo (R$)"><input className={inputCls} type="number" step="0.01" value={f.minimumWage} onChange={(e) => set("minimumWage", Number(e.target.value))} /></Field>
          <Field label="Teto do INSS (R$)"><input className={inputCls} type="number" step="0.01" value={f.ceiling} onChange={(e) => set("ceiling", Number(e.target.value))} /></Field>
          <Field label="Observações"><input className={inputCls} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></Field>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-semibold">Retorno real anual por classe (líquido de custos)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-zinc-500"><th>Classe</th><th>Pessimista %</th><th>Base %</th><th>Otimista %</th><th>Taxa contratada %</th><th>Custo anual %</th></tr></thead>
            <tbody>
              {f.classes.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="py-1 pr-2">{c.name}</td>
                  {(["pessimista", "base", "otimista"] as const).map((k) => (
                    <td key={k} className="px-1"><input aria-label={`${c.name} ${k}`} className={inputCls} type="number" step="0.1" value={pctInput(c[k])} onChange={(e) => setClass(c.id, { [k]: Number(e.target.value) / 100 })} /></td>
                  ))}
                  <td className="px-1"><input aria-label={`${c.name} contratada`} className={inputCls} type="number" step="0.1" placeholder="—" value={c.contracted === null ? "" : pctInput(c.contracted)}
                    onChange={(e) => setClass(c.id, { contracted: e.target.value === "" ? null : Number(e.target.value) / 100 })} /></td>
                  <td className="px-1"><input aria-label={`${c.name} custo`} className={inputCls} type="number" step="0.05" value={pctInput(c.annualCost)} onChange={(e) => setClass(c.id, { annualCost: Number(e.target.value) / 100 })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">A taxa contratada (IPCA+/RendA+ já comprados) vale nos três cenários.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={pending || changes === 0}>{pending ? "Salvando…" : `Salvar como v${latest.versao + 1}`}</Button>
          <span className="text-sm text-zinc-500">{changes === 0 ? "Sem alterações." : `${changes} alteração(ões) pendente(s).`}</span>
          {msg && <span role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </Card>

      <Card title="Histórico e comparação">
        <ul className="mb-4 divide-y divide-zinc-100 text-sm">
          {versions.map((v) => (
            <li key={v.versao} className="flex flex-wrap justify-between gap-2 py-2">
              <span><strong>v{v.versao}</strong> · {v.nome} · {formatDate(v.createdAt)}</span>
              <span className="text-zinc-600">inflação {formatPercent(v.inflation)} · {v.scenario} · mín. {formatBRL(v.minimumWage)}</span>
            </li>
          ))}
        </ul>
        {versions.length > 1 ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              Comparar
              <select aria-label="Versão base" className={`${inputCls} !w-auto`} value={aVer} onChange={(e) => setAVer(Number(e.target.value))}>
                {versions.map((v) => <option key={v.versao} value={v.versao}>v{v.versao}</option>)}
              </select>
              com
              <select aria-label="Versão nova" className={`${inputCls} !w-auto`} value={bVer} onChange={(e) => setBVer(Number(e.target.value))}>
                {versions.map((v) => <option key={v.versao} value={v.versao}>v{v.versao}</option>)}
              </select>
            </div>
            {diff.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma diferença.</p> : (
              <table className="w-full text-sm" data-testid="diff">
                <thead><tr className="text-left text-xs text-zinc-500"><th>Premissa</th><th>Antes</th><th>Depois</th></tr></thead>
                <tbody>{diff.map((d) => (
                  <tr key={d.key} className="border-t border-zinc-100"><td className="py-1">{d.label}</td><td className="text-red-700">{d.before}</td><td className="text-emerald-700">{d.after}</td></tr>
                ))}</tbody>
              </table>
            )}
          </>
        ) : <p className="text-sm text-zinc-500">Crie uma segunda versão para ver o diff.</p>}
      </Card>
    </div>
  );
}
