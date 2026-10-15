"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { saveOnboarding } from "@/app/onboarding/actions";
import { Button, Card, Field, Input, inputCls } from "@/components/ui";
import { planFormSchema, type PlanForm } from "@/lib/plan";

const STEPS: { title: string; fields: FieldPath<PlanForm>[] }[] = [
  { title: "Perfil", fields: ["birthDate", "horizonAge", "targetAges"] },
  { title: "INSS", fields: ["inss"] },
  { title: "Carteira atual", fields: ["accounts"] },
  { title: "Aportes", fields: ["contribution"] },
  { title: "Renda desejada", fields: ["expenses"] },
];

const CATEGORIES = [
  { value: "essencial", label: "Essencial" },
  { value: "discricionario", label: "Discricionário" },
  { value: "saude", label: "Saúde" },
] as const;

export function OnboardingWizard({
  defaultValues, classes,
}: { defaultValues: PlanForm; classes: { id: string; name: string }[] }) {
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<PlanForm>({ resolver: zodResolver(planFormSchema), defaultValues, mode: "onTouched" });
  const { register, control, formState: { errors }, trigger, handleSubmit, getValues } = form;
  const accounts = useFieldArray({ control, name: "accounts" });
  const expenses = useFieldArray({ control, name: "expenses" });
  const num = { valueAsNumber: true } as const;

  const next = async () => {
    if (await trigger(STEPS[step]!.fields)) setStep((s) => s + 1);
  };
  const submit = handleSubmit((values) =>
    start(async () => {
      const res = await saveOnboarding(values);
      if (res && !res.ok) setServerError(res.error);
    }),
  );
  const percent = (field: "inss.realGrowth") => ({
    // exibe em % e guarda como fração
    ...register(field, { setValueAs: (v) => (v === "" ? 0 : Number(v) / 100) }),
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.title} className={`rounded-full px-3 py-1 ${i === step ? "bg-zinc-900 text-white" : i < step ? "bg-zinc-200" : "bg-zinc-100 text-zinc-500"}`}>
            {i + 1}. {s.title}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card title="Perfil">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de nascimento" error={errors.birthDate?.message}>
              <Input type="date" {...register("birthDate")} />
            </Field>
            <Field label="Horizonte de planejamento (idade)" error={errors.horizonAge?.message}>
              <Input type="number" {...register("horizonAge", num)} />
            </Field>
            <Field label="Idade-alvo A" hint="Entre 50 e 75" error={errors.targetAges?.[0]?.message}>
              <Input type="number" {...register("targetAges.0", num)} />
            </Field>
            <Field label="Idade-alvo B" error={errors.targetAges?.[1]?.message}>
              <Input type="number" {...register("targetAges.1", num)} />
            </Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card title="INSS">
          <p className="mb-4 text-sm text-zinc-600">
            Aposentadoria por idade: 65 anos + 15 de contribuição. Informe o benefício estimado do Meu INSS; o cenário de
            aumento de contribuição fica em “Renda e gastos”. Aposentando antes da idade do benefício, a carteira cobre a “ponte”.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Anos de contribuição até hoje" error={errors.inss?.contributionYears?.message}>
              <Input type="number" step="0.1" {...register("inss.contributionYears", num)} />
            </Field>
            <Field label="Salário de contribuição atual (R$)" error={errors.inss?.contributionSalary?.message}>
              <Input type="number" step="0.01" {...register("inss.contributionSalary", num)} />
            </Field>
            <Field label="Benefício estimado (R$/mês, valores de hoje)" error={errors.inss?.benefit?.message}>
              <Input type="number" step="0.01" {...register("inss.benefit", num)} />
            </Field>
            <Field label="Idade de início do benefício" error={errors.inss?.startAge?.message}>
              <Input type="number" {...register("inss.startAge", num)} />
            </Field>
            <Field label="Crescimento real anual do salário mínimo (%)" error={errors.inss?.realGrowth?.message}>
              <Input type="number" step="0.1" defaultValue={defaultValues.inss.realGrowth * 100} {...percent("inss.realGrowth")} />
            </Field>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Carteira atual">
          <p className="mb-4 text-sm text-zinc-600">
            Desmarque “Entra na aposentadoria” para excluir a reserva de emergência. O custo base é o valor investido (define o IR sobre o ganho).
          </p>
          <div className="space-y-4">
            {accounts.fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-6">
                <Field label="Nome" error={errors.accounts?.[i]?.name?.message}>
                  <Input {...register(`accounts.${i}.name`)} />
                </Field>
                <Field label="Classe" error={errors.accounts?.[i]?.classId?.message}>
                  <select className={inputCls} {...register(`accounts.${i}.classId`)}>
                    <option value="">Selecione…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Instituição">
                  <Input {...register(`accounts.${i}.institution`)} />
                </Field>
                <Field label="Saldo (R$)" error={errors.accounts?.[i]?.balance?.message}>
                  <Input type="number" step="0.01" {...register(`accounts.${i}.balance`, num)} />
                </Field>
                <Field label="Custo base (R$)" error={errors.accounts?.[i]?.costBasis?.message}>
                  <Input type="number" step="0.01" {...register(`accounts.${i}.costBasis`, num)} />
                </Field>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register(`accounts.${i}.included`)} /> Entra na aposentadoria
                  </label>
                  <Button type="button" variant="ghost" onClick={() => accounts.remove(i)}>Remover</Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost"
              onClick={() => accounts.append({ name: "", classId: classes[0]?.id ?? "", balance: 0, costBasis: 0, included: true })}>
              + Adicionar conta
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="Aportes">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Aporte mensal (R$)" hint="Distribuído na proporção da carteira atual. Pausas e extras ficam em “Renda e gastos”." error={errors.contribution?.monthly?.message}>
              <Input type="number" step="0.01" {...register("contribution.monthly", num)} />
            </Field>
            <Field label="Reajuste real anual do aporte (%)">
              <Input type="number" step="0.1" defaultValue={defaultValues.contribution.realGrowth * 100}
                {...register("contribution.realGrowth", { setValueAs: (v) => (v === "" ? 0 : Number(v) / 100) })} />
            </Field>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card title="Renda desejada (valores de hoje)">
          <div className="space-y-4">
            {expenses.fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-6">
                <Field label="Categoria">
                  <select className={inputCls} {...register(`expenses.${i}.category`)}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Valor mensal (R$)" error={errors.expenses?.[i]?.monthly?.message}>
                  <Input type="number" step="0.01" {...register(`expenses.${i}.monthly`, num)} />
                </Field>
                <Field label="Idade início">
                  <Input type="number" {...register(`expenses.${i}.startAge`, num)} />
                </Field>
                <Field label="Idade fim (vazio = vitalício)">
                  <Input type="number" {...register(`expenses.${i}.endAge`, { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} />
                </Field>
                <Field label="Inflação extra (% a.a.)" hint="Saúde: 3% acima do IPCA">
                  <Input type="number" step="0.1" defaultValue={(getValues(`expenses.${i}.extraInflation`) ?? 0) * 100}
                    {...register(`expenses.${i}.extraInflation`, { setValueAs: (v) => (v === "" ? 0 : Number(v) / 100) })} />
                </Field>
                <div className="flex items-end">
                  <Button type="button" variant="ghost" onClick={() => expenses.remove(i)}>Remover</Button>
                </div>
              </div>
            ))}
            {typeof errors.expenses?.message === "string" && <p className="text-xs text-red-600">{errors.expenses.message}</p>}
            <Button type="button" variant="ghost"
              onClick={() => expenses.append({ category: "discricionario", monthly: 0, startAge: 60, endAge: null, extraInflation: 0, ageSteps: [] })}>
              + Adicionar meta
            </Button>
          </div>
        </Card>
      )}

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-between">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Voltar</Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>Próximo</Button>
        ) : (
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Concluir e ver o dashboard"}</Button>
        )}
      </div>
    </form>
  );
}
