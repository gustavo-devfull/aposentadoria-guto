/** nominal → real: (1 + nominal) / (1 + inflação) − 1 */
export function nominalToRealRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** real → nominal (inverso de nominalToRealRate). */
export function realToNominalRate(real: number, inflation: number): number {
  return (1 + real) * (1 + inflation) - 1;
}

/** Taxa anual → mensal equivalente: (1 + anual)^(1/12) − 1 */
export function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

/** Fator de conversão real → nominal após `months` meses. */
export function nominalFactor(months: number, inflation: number): number {
  return Math.pow(1 + inflation, months / 12);
}

/** valor_nominal = valor_real × (1 + inflação)^(meses/12) */
export function toNominal(real: number, months: number, inflation: number): number {
  return real * nominalFactor(months, inflation);
}

/** Índice absoluto de mês de "AAAA-MM". */
export function ymIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return y * 12 + (m - 1);
}

/** Meses completos entre a data de nascimento ("AAAA-MM-DD") e o mês "AAAA-MM". */
export function ageInMonths(birthDate: string, ym: string): number {
  const [by, bm] = birthDate.split("-").map(Number) as [number, number];
  return ymIndex(ym) - (by * 12 + (bm - 1));
}
