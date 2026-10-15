import { ageInMonths, monthlyRate, nominalFactor, ymIndex } from "./finance";
import { taxFraction } from "./tax";
import type { AssetClassInput, SimulationInput } from "./schema";

const EPS = 0.005; // meio centavo

export interface MonthRow {
  /** Índice do mês desde `startDate` (0 = primeiro mês). */
  m: number;
  /** Idade em anos (fracionária) no início do mês. */
  age: number;
  phase: "acumulacao" | "retirada";
  opening: number;
  contributions: number;
  returns: number;
  /** Saque bruto da carteira (inclui o IR). */
  grossWithdrawal: number;
  tax: number;
  netWithdrawal: number;
  /** Renda externa líquida de IR no mês. */
  externalIncome: number;
  /** Gasto desejado no mês (bruto, antes das rendas externas). */
  desiredNeed: number;
  /** Necessidade líquida não atendida no mês. */
  shortfall: number;
  closing: number;
  /** Fatores real→nominal no início e no fim do mês. */
  fStart: number;
  fEnd: number;
}

export interface RunSummary {
  rows: MonthRow[];
  retirementMonth: number;
  horizonMonths: number;
  /** Saldo no início do mês de aposentadoria. */
  projectedAtRetirement: number;
  /** Primeira idade (anos) em que a necessidade não foi atendida por falta de saldo. */
  exhaustionAge: number | null;
  /** Meses de retirada com necessidade líquida não atendida (qualquer método). */
  unmetMonths: number;
  finalBalance: number;
  /** Posição por classe no início da aposentadoria. */
  atRetirement: { classId: string; balance: number; basis: number }[];
}

interface ClassState {
  cls: AssetClassInput;
  rm: number;
  bal: number;
  basis: number;
}

export function netAnnualReturn(c: AssetClassInput): number {
  return c.realReturn - c.annualCost;
}

function withinAge(ageMonths: number, startAge: number, endAge: number | null): boolean {
  return ageMonths >= startAge * 12 && (endAge === null || ageMonths < endAge * 12);
}

/** Gasto desejado (R$ de hoje) no mês `m`, com inflação extra e degraus por idade. */
export function desiredNeedAt(input: SimulationInput, m: number, ageMonths: number): number {
  let total = 0;
  for (const g of input.expenses) {
    if (!withinAge(ageMonths, g.startAge, g.endAge)) continue;
    let factor = 1;
    const age = ageMonths / 12;
    for (const s of g.ageSteps) if (age >= s.fromAge) factor = s.factor;
    total += g.monthly * Math.pow(1 + g.extraInflation, m / 12) * factor;
  }
  return total;
}

/** Renda externa (bruta e líquida de IR) no mês `m`. */
export function externalIncomeAt(input: SimulationInput, m: number, ageMonths: number): { gross: number; net: number } {
  let gross = 0;
  let net = 0;
  for (const s of input.incomes) {
    if (!withinAge(ageMonths, s.startAge, s.endAge)) continue;
    const v = s.monthly * Math.pow(1 + s.realGrowth, m / 12);
    gross += v;
    net += s.taxable ? v * (1 - input.externalIncomeTaxRate) : v;
  }
  return { gross, net };
}

function contributionAt(input: SimulationInput, m: number): number {
  const startIdx = ymIndex(input.startDate) + m;
  let total = 0;
  const plan = input.contribution;
  const paused = input.pauses.some((p) => startIdx >= ymIndex(p.from) && startIdx <= ymIndex(p.to));
  if (!paused) {
    if (plan) {
      const s = ymIndex(plan.start);
      const e = plan.end ? ymIndex(plan.end) : Infinity;
      if (startIdx >= s && startIdx <= e) {
        total += plan.monthly * Math.pow(1 + plan.realGrowth, Math.floor((startIdx - s) / 12));
      }
    }
    // Aportes extras também respeitam pausas (renda variável) — decisão de produto, ver README.
    const month = (startIdx % 12) + 1;
    const year = Math.floor(startIdx / 12);
    for (const x of input.extras) {
      if (x.month !== month) continue;
      if (x.yearly || x.year === year) total += x.amount;
    }
  }
  return total;
}

/** Pesos (fração) para repartir `amount` entre as classes. */
function contributionWeights(input: SimulationInput): Map<string, number> {
  return new Map(Object.entries(input.contribution?.allocation ?? {}));
}

/** Fração do aporte por classe: alocação do plano; sem alocação, proporcional à carteira (ou 1ª classe). */
function contributionShares(states: ClassState[], weights: Map<string, number>): Map<string, number> {
  let wsum = 0;
  for (const w of weights.values()) wsum += w;
  const out = new Map<string, number>();
  if (wsum > 0) {
    for (const c of states) out.set(c.cls.id, (weights.get(c.cls.id) ?? 0) / wsum);
    return out;
  }
  const total = states.reduce((s, c) => s + c.bal, 0);
  states.forEach((c, i) => out.set(c.cls.id, total > 0 ? c.bal / total : i === 0 ? 1 : 0));
  return out;
}

interface Alloc {
  gross: number;
  tax: number;
  parts: { st: ClassState; gross: number }[];
}

/** Ordem de resgate das classes. */
function orderedStates(states: ClassState[], order: SimulationInput["redemptionOrder"]): ClassState[] {
  if (order === "proporcional") return states;
  return [...states].sort((a, b) => taxFraction(a.cls, a.bal, a.basis) - taxFraction(b.cls, b.bal, b.basis));
}

/** Saque bruto necessário para entregar `net` líquido (limitado ao saldo disponível). */
function grossForNet(states: ClassState[], net: number, order: SimulationInput["redemptionOrder"]): number {
  const total = states.reduce((s, c) => s + c.bal, 0);
  if (total <= 0 || net <= 0) return 0;
  if (order === "proporcional") {
    let netPerGross = 0;
    for (const c of states) netPerGross += (c.bal / total) * (1 - taxFraction(c.cls, c.bal, c.basis));
    return Math.min(total, net / netPerGross);
  }
  let remaining = net;
  let gross = 0;
  for (const c of orderedStates(states, order)) {
    if (remaining <= 0) break;
    const keep = 1 - taxFraction(c.cls, c.bal, c.basis);
    const capNet = c.bal * keep;
    const takeNet = Math.min(remaining, capNet);
    gross += keep > 0 ? takeNet / keep : 0;
    remaining -= takeNet;
  }
  return gross;
}

/** Reparte um saque bruto entre as classes seguindo a ordem de resgate. */
function distribute(states: ClassState[], gross: number, order: SimulationInput["redemptionOrder"]): Alloc {
  const total = states.reduce((s, c) => s + c.bal, 0);
  const parts: Alloc["parts"] = [];
  let tax = 0;
  if (total <= 0 || gross <= 0) return { gross: 0, tax: 0, parts };
  const g = Math.min(gross, total);
  if (order === "proporcional") {
    for (const c of states) {
      const part = g * (c.bal / total);
      parts.push({ st: c, gross: part });
      tax += part * taxFraction(c.cls, c.bal, c.basis);
    }
  } else {
    let remaining = g;
    for (const c of orderedStates(states, order)) {
      const part = Math.min(remaining, c.bal);
      parts.push({ st: c, gross: part });
      tax += part * taxFraction(c.cls, c.bal, c.basis);
      remaining -= part;
    }
  }
  return { gross: g, tax, parts };
}

function applyWithdrawal(alloc: Alloc) {
  for (const { st, gross } of alloc.parts) {
    if (st.bal <= 0 || gross <= 0) continue;
    const keep = Math.max(0, st.bal - gross) / st.bal;
    st.bal -= gross;
    st.basis *= keep; // custo-base reduz proporcionalmente
    if (st.bal < 1e-9) {
      st.bal = 0;
      st.basis = 0;
    }
  }
}

/** Simulação mensal completa (determinística, em reais de hoje). */
export function simulate(input: SimulationInput): RunSummary {
  const ageMonths0 = ageInMonths(input.birthDate, input.startDate);
  const horizonMonths = Math.round(input.horizonAge * 12) - ageMonths0;
  if (horizonMonths <= 0) throw new Error("Horizonte já ultrapassado");
  const retirementMonth = Math.min(horizonMonths, Math.max(0, Math.round(input.retirementAge * 12) - ageMonths0));

  const states: ClassState[] = input.classes.map((cls) => ({
    cls,
    rm: monthlyRate(netAnnualReturn(cls)),
    bal: 0,
    basis: 0,
  }));
  const byId = new Map(states.map((s) => [s.cls.id, s]));
  for (const a of input.accounts) {
    if (!a.included) continue;
    const st = byId.get(a.classId);
    if (!st) continue;
    st.bal += a.balance;
    st.basis += Math.min(a.costBasis, a.balance); // prejuízo não gera crédito de IR
  }
  const weights = contributionWeights(input);

  const rows: MonthRow[] = [];
  let exhaustionAge: number | null = null;
  let unmetMonths = 0;
  let projectedAtRetirement = states.reduce((s, c) => s + c.bal, 0);
  let atRetirement = states.map((s) => ({ classId: s.cls.id, balance: s.bal, basis: s.basis }));
  let fixedAnnualGross = 0;

  for (let m = 0; m < horizonMonths; m++) {
    const ageM = ageMonths0 + m;
    const opening = states.reduce((s, c) => s + c.bal, 0);
    const fStart = nominalFactor(m, input.inflation);
    const fEnd = nominalFactor(m + 1, input.inflation);

    if (m === retirementMonth) {
      projectedAtRetirement = opening;
      atRetirement = states.map((s) => ({ classId: s.cls.id, balance: s.bal, basis: s.basis }));
    }

    if (m < retirementMonth) {
      let returns = 0;
      for (const c of states) {
        const g = c.bal * c.rm;
        c.bal += g;
        returns += g;
      }
      const contrib = contributionAt(input, m);
      if (contrib > 0) {
        const shares = contributionShares(states, weights);
        for (const c of states) {
          const add = contrib * (shares.get(c.cls.id) ?? 0);
          c.bal += add;
          c.basis += add;
        }
      }
      const closing = states.reduce((s, c) => s + c.bal, 0);
      rows.push({
        m, age: ageM / 12, phase: "acumulacao", opening, contributions: contrib, returns,
        grossWithdrawal: 0, tax: 0, netWithdrawal: 0, externalIncome: 0, desiredNeed: 0, shortfall: 0,
        closing, fStart, fEnd,
      });
      continue;
    }

    // ---- Retirada: saque no início do mês, rendimento sobre o que sobra ----
    const need = desiredNeedAt(input, m, ageM);
    const ext = externalIncomeAt(input, m, ageM);
    const netNeed = Math.max(0, need - ext.net);

    let grossTarget: number;
    if (input.method === "taxa_fixa") {
      if ((m - retirementMonth) % 12 === 0) fixedAnnualGross = opening * input.fixedWithdrawalRate;
      grossTarget = fixedAnnualGross / 12;
    } else if (input.method === "preservar_capital") {
      // Saque no início do mês + rendimento sobre o restante: w = (B − w)·r  ⇒  w = B·r/(1+r)
      const cap = states.reduce((s, c) => s + (c.bal * c.rm) / (1 + c.rm), 0);
      grossTarget = Math.min(grossForNet(states, netNeed, input.redemptionOrder), Math.max(0, cap));
    } else {
      grossTarget = grossForNet(states, netNeed, input.redemptionOrder);
    }

    const alloc = distribute(states, grossTarget, input.redemptionOrder);
    applyWithdrawal(alloc);
    const netWithdrawal = alloc.gross - alloc.tax;
    const shortfall = Math.max(0, netNeed - netWithdrawal);
    if (shortfall > EPS) {
      unmetMonths++;
      if (exhaustionAge === null && opening - alloc.gross < EPS) exhaustionAge = ageM / 12;
    }

    let returns = 0;
    for (const c of states) {
      const g = c.bal * c.rm;
      c.bal += g;
      returns += g;
    }
    const closing = states.reduce((s, c) => s + c.bal, 0);
    rows.push({
      m, age: ageM / 12, phase: "retirada", opening, contributions: 0, returns,
      grossWithdrawal: alloc.gross, tax: alloc.tax, netWithdrawal, externalIncome: ext.net,
      desiredNeed: need, shortfall, closing, fStart, fEnd,
    });
  }

  if (retirementMonth >= horizonMonths) projectedAtRetirement = states.reduce((s, c) => s + c.bal, 0);
  return {
    rows, retirementMonth, horizonMonths, projectedAtRetirement, exhaustionAge, unmetMonths,
    finalBalance: states.reduce((s, c) => s + c.bal, 0), atRetirement,
  };
}
