"use client";

import { useMemo, useState, useTransition } from "react";
import { savePlanAction, saveScenarioAction } from "@/app/simulador/actions";
import { RetirementResults } from "@/components/retirement-results";
import { Button, Card, Field, Input, MoneyField, NumberField } from "@/components/ui";
import { ageOn, toSimpleInput, type PlanInput } from "@/lib/plan";
import { RATE_PRESETS } from "@/lib/simulator";

const fmtPct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const IPCA_SPREAD = 0.07;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

export function Simulator({ initial, hasPlan, canSave = true }: { initial: PlanInput; hasPlan: boolean; canSave?: boolean }) {
  const [plan, setPlan] = useState<PlanInput>(initial);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PlanInput>(k: K) => (v: PlanInput[K]) => setPlan((o) => ({ ...o, [k]: v }));

  const validBirth = /^\d{4}-\d{2}-\d{2}$/.test(plan.birthDate) && ageOn(plan.birthDate) > 0;
  const input = useMemo(() => toSimpleInput(validBirth ? plan : { ...plan, birthDate: initial.birthDate }), [plan, validBirth, initial.birthDate]);
  const realRate = (1 + plan.annualRate) / (1 + plan.inflation) - 1;
  const ipcaRate = (1 + IPCA_SPREAD) * (1 + plan.inflation) - 1;
  const presets = [...RATE_PRESETS.map((p) => ({ label: p.label, rate: p.rate, text: fmtPct(p.rate) })), { label: "Tesouro IPCA+", rate: ipcaRate, text: "7% + inflação" }];
  const dirty = JSON.stringify(plan) !== JSON.stringify(initial);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? okMsg : (r.error ?? "Não foi possível salvar.") });
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
          <p className="mt-1 text-sm text-muted">Mude os valores e veja a renda na hora.</p>
        </div>
        {dirty && <Button variant="ghost" onClick={() => { setPlan(initial); setMsg(null); }}>{hasPlan ? "Voltar ao meu plano" : "Restaurar"}</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-6">
            <Section title="Hoje">
              <Field label="Data de nascimento" htmlFor="nasc" hint={validBirth ? `${ageOn(plan.birthDate)} anos` : "Data inválida"}>
                <Input id="nasc" type="date" value={plan.birthDate} onChange={(e) => set("birthDate")(e.target.value)} />
              </Field>
              <MoneyField label="Investido hoje" value={plan.invested} onChange={set("invested")} />
              <MoneyField label="Aporte mensal" value={plan.monthly} onChange={set("monthly")} hint="Até a aposentadoria (60 ou 65). Corrigido pela inflação." />
            </Section>

            <Section title="Rendimento">
              <div className="space-y-2">
                <NumberField label="Taxa de juros" value={plan.annualRate} onChange={set("annualRate")} percent suffix="% a.a." hint="Use a taxa líquida de IR." />
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atalhos de taxa">
                  {presets.map((p) => {
                    const on = Math.abs(plan.annualRate - p.rate) < 1e-9;
                    return (
                      <button key={p.label} type="button" aria-pressed={on} onClick={() => set("annualRate")(p.rate)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:border-accent/50 hover:text-fg"}`}>
                        {p.label} <span className="opacity-70">{p.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <NumberField label="Inflação" value={plan.inflation} onChange={set("inflation")} percent suffix="% a.a."
                hint={<>Rende <strong className="font-medium text-fg">{fmtPct(realRate)} a.a.</strong> acima da inflação.</>} />
            </Section>

            <Section title="Aposentadoria">
              <MoneyField label="INSS (salário mínimo)" value={plan.inssBenefit} onChange={set("inssBenefit")} hint={`A partir dos ${plan.inssStartAge} anos.`} />
              <NumberField label="A renda deve durar até" value={plan.horizonAge} onChange={(v) => set("horizonAge")(Math.round(v))} suffix="anos" />
            </Section>

            <div className="space-y-3 border-t border-line pt-5">
              <Button className="w-full py-2.5" disabled={pending || !canSave} onClick={() => run(() => savePlanAction(plan), "Plano salvo. Ele aparece em Meu plano.")}>
                Salvar como meu plano
              </Button>
              <div className="flex gap-2">
                <Input placeholder="Nome do cenário" aria-label="Nome do cenário" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                <Button variant="ghost" className="shrink-0" disabled={pending || !canSave}
                  onClick={() => run(async () => {
                    const r = await saveScenarioAction(name, plan);
                    if (r.ok) setName("");
                    return r;
                  }, "Cenário salvo. Veja em Comparar.")}>
                  Salvar cenário
                </Button>
              </div>
              {msg && <p role="status" className={`text-sm ${msg.ok ? "text-good" : "text-red-600"}`}>{msg.text}</p>}
            </div>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <RetirementResults input={input} />
          <p className="text-xs text-muted">
            <strong className="font-medium">R$ de hoje</strong>: poder de compra atual. <strong className="font-medium">Projetado</strong>: o valor nominal naquele ano, corrigido pela inflação informada.
          </p>
        </div>
      </div>
    </div>
  );
}
