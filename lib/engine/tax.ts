import type { AssetClassInput, TaxRegime } from "./schema";

interface RegimeRule {
  rate: number;
  /** "gain": IR só sobre a parcela de ganho. "total": sobre o valor resgatado inteiro (PGBL). */
  base: "gain" | "total";
}

/** Alíquotas efetivas padrão (longo prazo). Editáveis por classe via `taxRateOverride`. */
export const REGIME_DEFAULTS: Record<TaxRegime, RegimeRule> = {
  renda_fixa_regressivo: { rate: 0.15, base: "gain" },
  acoes_15: { rate: 0.15, base: "gain" },
  isento: { rate: 0, base: "gain" },
  pgbl_regressivo: { rate: 0.1, base: "total" },
  vgbl_regressivo: { rate: 0.1, base: "gain" },
  custom: { rate: 0, base: "gain" },
};

export function regimeRule(cls: Pick<AssetClassInput, "taxRegime" | "taxRateOverride">): RegimeRule {
  const def = REGIME_DEFAULTS[cls.taxRegime];
  return { rate: cls.taxRateOverride ?? def.rate, base: def.base };
}

/**
 * Fração do valor resgatado que vai para o IR, dado o estado atual da posição.
 * Ex.: ganho 50% e alíquota 15% → 7,5%.
 */
export function taxFraction(
  cls: Pick<AssetClassInput, "taxRegime" | "taxRateOverride">,
  balance: number,
  costBasis: number,
): number {
  const rule = regimeRule(cls);
  if (rule.base === "total") return rule.rate;
  if (balance <= 0) return 0;
  const gainRatio = Math.min(1, Math.max(0, (balance - costBasis) / balance));
  return rule.rate * gainRatio;
}

/** IR devido ao resgatar `gross` de uma posição. */
export function withdrawalTax(
  gross: number,
  cls: Pick<AssetClassInput, "taxRegime" | "taxRateOverride">,
  balance: number,
  costBasis: number,
): number {
  return gross * taxFraction(cls, balance, costBasis);
}
