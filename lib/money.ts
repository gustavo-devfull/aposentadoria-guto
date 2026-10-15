import Decimal from "decimal.js";

/** Fronteira banco ↔ motor: strings numeric(18,2) viram number no motor e voltam arredondadas a centavos. */
export function fromDbMoney(v: string | number | null | undefined): number {
  return v == null ? 0 : new Decimal(v).toNumber();
}

export function toDbMoney(v: number): string {
  return new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toFixed(2);
}

/** Soma monetária exata (evita erro de ponto flutuante em totais exibidos/persistidos). */
export function sumMoney(values: Array<number | string>): string {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)).toDecimalPlaces(2).toFixed(2);
}
