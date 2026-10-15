"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, inputCls } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

type Row = Record<string, unknown>;

export interface Col<T extends Row> {
  key: string;
  label: string;
  type: "text" | "number" | "percent" | "select" | "checkbox" | "month" | "optNumber" | "optText";
  options?: { value: string; label: string }[];
  step?: string;
  hint?: string;
  /** Para colunas que mapeiam um campo aninhado (ex.: degrau de gasto). */
  get?: (row: T) => unknown;
  set?: (row: T, value: unknown) => T;
}

/** Editor genérico de listas: edita em memória e grava a lista inteira pelo `action` (validada no servidor com Zod). */
export function ListEditor<T extends Row>({
  title, description, columns, initial, blank, action, emptyText = "Nenhum item.",
}: {
  title: string; description?: string; columns: Col<T>[]; initial: T[]; blank: () => T;
  action: (rows: T[]) => Promise<ActionResult>; emptyText?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<T[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const read = (row: T, c: Col<T>) => (c.get ? c.get(row) : row[c.key]);
  const write = (i: number, c: Col<T>, v: unknown) =>
    setRows((rs) => rs.map((r, j) => (j !== i ? r : c.set ? c.set(r, v) : ({ ...r, [c.key]: v } as T))));
  const num = (raw: string) => (raw === "" ? 0 : Number(raw));

  const cell = (row: T, i: number, c: Col<T>) => {
    const v = read(row, c);
    const aria = `${c.label} (linha ${i + 1})`;
    switch (c.type) {
      case "checkbox":
        return <input type="checkbox" aria-label={aria} checked={Boolean(v)} onChange={(e) => write(i, c, e.target.checked)} />;
      case "select":
        return (
          <select aria-label={aria} className={`${inputCls} min-w-[9.5rem]`} value={String(v ?? "")} onChange={(e) => write(i, c, e.target.value)}>
            {!c.options?.some((o) => o.value === v) && <option value="">Selecione…</option>}
            {c.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "percent":
        return <input aria-label={aria} className={inputCls} type="number" step={c.step ?? "0.1"} value={Number(((Number(v) || 0) * 100).toFixed(4))} onChange={(e) => write(i, c, num(e.target.value) / 100)} />;
      case "number":
        return <input aria-label={aria} className={inputCls} type="number" step={c.step ?? "any"} value={Number(v ?? 0)} onChange={(e) => write(i, c, num(e.target.value))} />;
      case "optNumber":
        return <input aria-label={aria} className={inputCls} type="number" value={v === null || v === undefined ? "" : Number(v)} onChange={(e) => write(i, c, e.target.value === "" ? null : Number(e.target.value))} />;
      case "optText":
        return <input aria-label={aria} className={inputCls} value={String(v ?? "")} onChange={(e) => write(i, c, e.target.value === "" ? null : e.target.value)} />;
      case "month":
        return <input aria-label={aria} className={inputCls} type="month" value={String(v ?? "")} onChange={(e) => write(i, c, e.target.value)} />;
      default:
        return <input aria-label={aria} className={inputCls} value={String(v ?? "")} onChange={(e) => write(i, c, e.target.value)} />;
    }
  };

  const save = () =>
    start(async () => {
      const r = await action(rows);
      setMsg(r.ok ? { ok: true, text: "Salvo." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <Card title={title}>
      {description && <p className="mb-3 text-sm text-zinc-600">{description}</p>}
      {rows.length === 0 ? (
        <p className="mb-3 text-sm text-zinc-500">{emptyText}</p>
      ) : (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                {columns.map((c) => <th key={c.key} className="px-1 pb-1 font-medium" title={c.hint}>{c.label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="align-top">
                  {columns.map((c) => <td key={c.key} className="px-1 py-1">{cell(row, i, c)}</td>)}
                  <td className="px-1 py-1">
                    <Button type="button" variant="ghost" aria-label={`Remover linha ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" onClick={() => setRows((rs) => [...rs, blank()])}>+ Adicionar</Button>
        <Button type="button" onClick={save} disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </Card>
  );
}
