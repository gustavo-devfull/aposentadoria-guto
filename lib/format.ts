const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export const formatBRL = (v: number) => brl.format(v);
export const formatPercent = (fraction: number) => pct.format(fraction);
export const formatDate = (d: Date | string) => date.format(typeof d === "string" ? new Date(d) : d);
