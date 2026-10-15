import type { AnnualRow } from "@/lib/engine";

export type CsvMode = "real" | "nominal";

/** Escapa um campo CSV (separador ";"). */
const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** Número no formato brasileiro (vírgula decimal, sem milhar) — abre direto no Excel pt-BR. */
const num = (v: number) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");

const HEADER = [
  "Idade", "Saldo inicial", "Aportes", "Rendimentos", "Saques (bruto)", "IR", "Rendas externas", "Saldo final",
];

/** Tabela anual → CSV (separador ";", BOM UTF-8 para acentos no Excel). */
export function annualTableToCsv(rows: AnnualRow[], mode: CsvMode): string {
  const lines = [HEADER.map(esc).join(";")];
  for (const r of rows) {
    lines.push(
      [
        String(r.age), num(r.opening[mode]), num(r.contributions[mode]), num(r.returns[mode]), num(r.withdrawals[mode]),
        num(r.tax[mode]), num(r.externalIncome[mode]), num(r.closing[mode]),
      ].join(";"),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
