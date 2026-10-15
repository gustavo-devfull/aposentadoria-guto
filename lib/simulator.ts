/**
 * Simulador simples: patrimônio de hoje + aporte mensal rendendo a uma taxa anual até a aposentadoria,
 * e a renda mensal que esse patrimônio paga, somada ao INSS (salário mínimo) a partir dos 65.
 *
 * O cálculo é feito em R$ de hoje: a taxa nominal é convertida em taxa real descontando a inflação,
 * e o aporte é considerado corrigido pela inflação (mesmo poder de compra). O valor projetado
 * (nominal, no ano em que acontece) é o valor de hoje × (1 + inflação)^anos.
 * Convenção do motor: aporte no fim do mês. Impostos não são calculados — use a taxa líquida de IR.
 */

export interface SimpleInput {
  currentAge: number;
  /** Patrimônio investido hoje (R$). */
  invested: number;
  /** Aporte mensal (R$ de hoje). */
  monthly: number;
  /** Taxa de juros nominal ao ano (fração: 0.12 = 12% a.a.). */
  annualRate: number;
  /** Inflação ao ano (fração). */
  inflation: number;
  /** Benefício do INSS (R$ de hoje/mês) — salário mínimo. */
  inssBenefit: number;
  inssStartAge: number;
  /** Idade até a qual a renda deve durar no modo "consumindo o patrimônio". */
  horizonAge: number;
}

export interface SimpleResult {
  retirementAge: number;
  months: number;
  /** Patrimônio na aposentadoria (R$ de hoje). */
  patrimonio: number;
  /** Quanto do patrimônio veio dos aportes (soma, sem rendimento). */
  totalAportado: number;
  /** Renda vivendo só dos rendimentos: o patrimônio fica intacto. */
  rendaJuros: number;
  /** Renda consumindo o patrimônio até `horizonAge`. */
  rendaConsumo: number;
  /** INSS somado a partir de `inssStartAge`. */
  inss: number;
  /** Anos até a aposentadoria e até o início do INSS (para datar os valores projetados). */
  anosAteAposentadoria: number;
  anosAteInss: number;
  /** Os mesmos valores em R$ projetados (nominais). Rendas: 1º mês da aposentadoria; INSS e totais: aos `inssStartAge`. */
  projetado: {
    patrimonio: number;
    totalAportado: number;
    rendaJuros: number;
    rendaConsumo: number;
    inss: number;
    totalJuros: number;
    totalConsumo: number;
  };
}

/** Fator de correção pela inflação: R$ de hoje → R$ daqui a `years` anos. */
export function inflationFactor(inflation: number, years: number): number {
  return Math.pow(1 + inflation, Math.max(0, years));
}

/** Soma nominal de `n` aportes mensais de `pmt` (R$ de hoje) corrigidos pela inflação mês a mês. */
export function nominalContributions(pmt: number, inflation: number, n: number): number {
  const g = Math.pow(1 + inflation, 1 / 12);
  if (n <= 0) return 0;
  if (Math.abs(g - 1) < 1e-12) return pmt * n;
  return (pmt * g * (Math.pow(g, n) - 1)) / (g - 1);
}

/** Taxa real mensal equivalente a uma taxa nominal anual e uma inflação anual. */
export function realMonthlyRate(annualRate: number, inflation: number): number {
  return Math.pow((1 + annualRate) / (1 + inflation), 1 / 12) - 1;
}

/** Valor futuro de `pv` + `pmt` mensal (fim do mês) por `n` meses à taxa `r`. */
export function futureValue(pv: number, pmt: number, r: number, n: number): number {
  if (n <= 0) return pv;
  const g = Math.pow(1 + r, n);
  return pv * g + (Math.abs(r) < 1e-12 ? pmt * n : (pmt * (g - 1)) / r);
}

/** Saque mensal constante (início do mês) que zera `pv` em `n` meses à taxa `r`. */
export function annuityPayment(pv: number, r: number, n: number): number {
  if (n <= 0 || pv <= 0) return 0;
  if (Math.abs(r) < 1e-12) return pv / n;
  return (pv * r) / ((1 - Math.pow(1 + r, -n)) * (1 + r));
}

export function simulateRetirement(input: SimpleInput, retirementAge: number): SimpleResult {
  const r = realMonthlyRate(input.annualRate, input.inflation);
  const months = Math.max(0, Math.round((retirementAge - input.currentAge) * 12));
  const patrimonio = futureValue(input.invested, input.monthly, r, months);
  const payoutMonths = Math.max(0, Math.round((input.horizonAge - retirementAge) * 12));
  // Saque no início do mês: P·r/(1+r) é o máximo que mantém o patrimônio exatamente intacto.
  const rendaJuros = Math.max(0, (patrimonio * r) / (1 + r));
  const rendaConsumo = annuityPayment(patrimonio, r, payoutMonths);
  const anosAteAposentadoria = months / 12;
  const anosAteInss = Math.max(0, input.inssStartAge - input.currentAge);
  const fRet = inflationFactor(input.inflation, anosAteAposentadoria);
  const fInss = inflationFactor(input.inflation, anosAteInss);
  return {
    retirementAge,
    months,
    patrimonio,
    totalAportado: input.monthly * months,
    rendaJuros,
    rendaConsumo,
    inss: input.inssBenefit,
    anosAteAposentadoria,
    anosAteInss,
    projetado: {
      patrimonio: patrimonio * fRet,
      totalAportado: nominalContributions(input.monthly, input.inflation, months),
      rendaJuros: rendaJuros * fRet,
      rendaConsumo: rendaConsumo * fRet,
      inss: input.inssBenefit * fInss,
      totalJuros: (rendaJuros + input.inssBenefit) * fInss,
      totalConsumo: (rendaConsumo + input.inssBenefit) * fInss,
    },
  };
}

export interface ChartPoint { age: number; [key: string]: number }

/**
 * Patrimônio no fim de cada ano de idade, acumulando até a aposentadoria e consumindo até o horizonte.
 * `nominal`: em R$ projetados (corrigidos pela inflação até aquele ano) em vez de R$ de hoje.
 */
export function wealthByAge(input: SimpleInput, retirementAges: number[], nominal = false): ChartPoint[] {
  const r = realMonthlyRate(input.annualRate, input.inflation);
  const start = Math.floor(input.currentAge);
  const points: ChartPoint[] = [];
  const series = retirementAges.map((age) => {
    const res = simulateRetirement(input, age);
    return { age, saque: res.rendaConsumo, balance: input.invested };
  });
  points.push({ age: start, ...Object.fromEntries(series.map((s) => [`a${s.age}`, s.balance])) });
  for (let age = start + 1; age <= input.horizonAge; age++) {
    const point: ChartPoint = { age };
    for (const s of series) {
      for (let m = 0; m < 12; m++) {
        const monthAge = age - 1 + m / 12;
        if (monthAge < s.age) s.balance = s.balance * (1 + r) + input.monthly;
        else s.balance = Math.max(0, (s.balance - s.saque) * (1 + r));
      }
      point[`a${s.age}`] = Math.round(s.balance * (nominal ? inflationFactor(input.inflation, age - start) : 1));
    }
    points.push(point);
  }
  return points;
}

export type IncomeMode = "consumo" | "juros";

export interface MonthRow {
  /** 1 = próximo mês. */
  month: number;
  /** "AAAA-MM". */
  date: string;
  /** Idade em anos (fracionária). */
  age: number;
  phase: "acumulacao" | "aposentadoria";
  saldoInicial: number;
  aporte: number;
  saque: number;
  juros: number;
  inss: number;
  /** Renda do mês: saque + INSS. */
  renda: number;
  saldoFinal: number;
  /** Fator R$ de hoje → R$ projetados daquele mês. */
  fator: number;
}

/**
 * Mês a mês, em R$ de hoje, de agora até `horizonAge`: aportes até a aposentadoria e,
 * depois, saque constante (consumindo até o horizonte ou só os juros) + INSS a partir de `inssStartAge`.
 * Mesmas convenções de `simulateRetirement`: aporte no fim do mês, saque no início.
 */
export function monthlySchedule(input: SimpleInput, retirementAge: number, mode: IncomeMode, today: Date = new Date()): MonthRow[] {
  const r = realMonthlyRate(input.annualRate, input.inflation);
  const res = simulateRetirement(input, retirementAge);
  const saqueMensal = mode === "consumo" ? res.rendaConsumo : res.rendaJuros;
  const total = Math.max(0, Math.round((input.horizonAge - input.currentAge) * 12));
  const inssFrom = Math.round((input.inssStartAge - input.currentAge) * 12);
  const y0 = today.getUTCFullYear(), m0 = today.getUTCMonth();
  const gm = Math.pow(1 + input.inflation, 1 / 12);
  const rows: MonthRow[] = [];
  let saldo = input.invested;
  for (let k = 1; k <= total; k++) {
    const d = new Date(Date.UTC(y0, m0 + k, 1));
    const retired = k > res.months;
    const saldoInicial = saldo;
    const saque = retired ? Math.min(saqueMensal, saldo) : 0;
    const aporte = retired ? 0 : input.monthly;
    const juros = (saldo - saque) * r;
    saldo = saldo - saque + juros + aporte;
    if (Math.abs(saldo) < 0.005) saldo = 0;
    const inss = k > inssFrom ? input.inssBenefit : 0;
    rows.push({
      month: k,
      date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      age: input.currentAge + k / 12,
      phase: retired ? "aposentadoria" : "acumulacao",
      saldoInicial, aporte, saque, juros, inss,
      renda: saque + inss,
      saldoFinal: saldo,
      fator: Math.pow(gm, k),
    });
  }
  return rows;
}

/** Atalhos de taxa (exemplos editáveis — confira as taxas do momento). */
export const RATE_PRESETS = [
  { label: "Poupança", rate: 0.0617 },
  { label: "Tesouro Selic / CDB 100% CDI", rate: 0.12 },
  { label: "Pré-fixado", rate: 0.13 },
] as const;

