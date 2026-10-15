"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, error, hint, htmlFor, children }: { label: string; error?: string; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="block text-sm">
      <label htmlFor={htmlFor} className="mb-1.5 block font-medium">{label}</label>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}

export const inputCls =
  "w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Button({
  variant = "primary", className = "", ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50";
  const v = variant === "primary"
    ? "bg-accent text-accent-fg hover:bg-accent-hover"
    : "border border-line bg-surface hover:bg-subtle";
  return <button {...rest} className={`${base} ${v} ${className}`} />;
}

/** Campo com prefixo/sufixo (ex.: "R$", "% a.a."). */
function Affixed({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center rounded-lg border border-line bg-surface transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
      {prefix && <span className="whitespace-nowrap pl-3 text-sm text-muted">{prefix}</span>}
      {children}
      {suffix && <span className="whitespace-nowrap pr-3 text-sm text-muted">{suffix}</span>}
    </div>
  );
}

const affixInput = "w-full min-w-0 bg-transparent px-3 py-2 text-sm tabular-nums outline-none";
const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Valor em reais (inteiro) com separador de milhar: digita 800000 → mostra 800.000. */
export function MoneyField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Affixed prefix="R$">
        <input id={id} className={affixInput} inputMode="numeric" autoComplete="off"
          value={value ? intFmt.format(value) : ""} placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)} />
      </Affixed>
    </Field>
  );
}

/** Número decimal com vírgula; `percent` guarda fração (12 → 0.12). */
export function NumberField({
  label, value, onChange, hint, suffix, percent = false,
}: { label: string; value: number; onChange: (v: number) => void; hint?: ReactNode; suffix?: string; percent?: boolean }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = percent ? Math.round(value * 10000) / 100 : value;
  const text = draft ?? shown.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false });
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Affixed suffix={suffix}>
        <input id={id} className={affixInput} inputMode="decimal" autoComplete="off" value={text}
          onFocus={() => setDraft(text)} onBlur={() => setDraft(null)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d,.-]/g, "");
            setDraft(raw);
            const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
            if (raw !== "" && Number.isFinite(n)) onChange(percent ? n / 100 : n);
          }} />
      </Affixed>
    </Field>
  );
}
