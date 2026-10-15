const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export const formatBRL = (v: number) => brl.format(v);
/** Reais sem centavos — para resultados de simulação (centavos seriam falsa precisão). */
export const formatBRL0 = (v: number) => brl0.format(v);
export const formatPercent = (fraction: number) => pct.format(fraction);
export const formatDate = (d: Date | string) => date.format(typeof d === "string" ? new Date(d) : d);
