import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accounts, assetClasses, assumptionSets, contributionPlans, expenseGoals, inssSettings, profiles,
} from "@/db/schema";
import { DEFAULT_ASSET_CLASSES, DEFAULT_INFLATION, type AssetClassTemplate } from "@/lib/engine";
import { currentYm, planFormSchema, type PlanData, type PlanForm } from "@/lib/plan";
import { fromDbMoney, toDbMoney } from "@/lib/money";

const num = (v: string | null | undefined) => (v == null ? 0 : Number(v));

/** Garante as classes padrão do usuário e as devolve como templates (ids = uuids do banco). */
export async function ensureAssetClasses(userId: string): Promise<AssetClassTemplate[]> {
  const db = getDb();
  let rows = await db.select().from(assetClasses).where(eq(assetClasses.userId, userId));
  if (rows.length === 0) {
    rows = await db
      .insert(assetClasses)
      .values(
        DEFAULT_ASSET_CLASSES.map((c) => ({
          userId, nome: c.name,
          retornoRealPessimista: String(c.returns.pessimista),
          retornoRealBase: String(c.returns.base),
          retornoRealOtimista: String(c.returns.otimista),
          taxaRealContratada: c.contractedRealRate === undefined ? null : String(c.contractedRealRate),
          custoAnual: String(c.annualCost),
          regimeIr: c.taxRegime,
          volatilidade: String(c.volatility),
        })),
      )
      .returning();
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.nome,
    returns: { pessimista: num(r.retornoRealPessimista), base: num(r.retornoRealBase), otimista: num(r.retornoRealOtimista) },
    ...(r.taxaRealContratada != null ? { contractedRealRate: num(r.taxaRealContratada) } : {}),
    annualCost: num(r.custoAnual),
    taxRegime: r.regimeIr,
    ...(r.aliquotaEfetivaCustom != null ? { taxRateOverride: num(r.aliquotaEfetivaCustom) } : {}),
    volatility: num(r.volatilidade ?? "0.1"),
  }));
}

/** Plano completo do usuário, ou null se o onboarding ainda não foi concluído. */
export async function loadPlan(userId: string): Promise<PlanData | null> {
  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  const [inss] = await db.select().from(inssSettings).where(eq(inssSettings.userId, userId));
  if (!profile || !inss) return null;
  const classes = await ensureAssetClasses(userId);
  const accs = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const [contrib] = await db.select().from(contributionPlans).where(eq(contributionPlans.userId, userId));
  const goals = await db.select().from(expenseGoals).where(eq(expenseGoals.userId, userId));
  const [assump] = await db
    .select().from(assumptionSets).where(eq(assumptionSets.userId, userId)).orderBy(desc(assumptionSets.createdAt)).limit(1);

  return {
    startDate: currentYm(),
    birthDate: profile.dataNascimento,
    horizonAge: profile.horizonteIdade,
    targetAges: profile.idadesAlvo,
    inss: {
      contributionYears: num(inss.anosContribuicaoAtual),
      contributionSalary: fromDbMoney(inss.salarioContribuicaoAtual),
      benefit: fromDbMoney(inss.beneficioEstimado),
      startAge: inss.idadeInicioBeneficio,
      realGrowth: num(inss.crescimentoRealMinimo),
    },
    accounts: accs.map((a) => ({
      id: a.id, name: a.nome, classId: a.assetClassId, institution: a.instituicao ?? undefined,
      balance: fromDbMoney(a.saldoAtual), costBasis: fromDbMoney(a.custoBase), included: a.incluirNaAposentadoria,
    })),
    contribution: { monthly: fromDbMoney(contrib?.valorMensal), realGrowth: num(contrib?.reajusteRealAnual) },
    expenses: goals.map((g) => ({
      category: g.categoria, monthly: fromDbMoney(g.valorMensal), startAge: g.idadeInicio, endAge: g.idadeFim,
      extraInflation: num(g.inflacaoExtraAnual),
    })),
    scenario: assump?.cenario ?? "base",
    inflation: assump ? num(assump.inflacaoLongoPrazo) : DEFAULT_INFLATION,
    method: assump?.metodoRetirada ?? "consumir_ate_horizonte",
    redemptionOrder: assump?.ordemResgate ?? "proporcional",
    classes,
  };
}

/** Salva o onboarding. Revalida no servidor com o mesmo schema do cliente e checa a propriedade das classes. */
export async function savePlanForm(userId: string, raw: unknown): Promise<void> {
  const form: PlanForm = planFormSchema.parse(raw);
  const db = getDb();
  const owned = new Set((await ensureAssetClasses(userId)).map((c) => c.id));
  for (const a of form.accounts) if (!owned.has(a.classId)) throw new Error("Classe de ativo inválida");

  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(profiles)
    .values({ userId, dataNascimento: form.birthDate, horizonteIdade: form.horizonAge, idadesAlvo: form.targetAges })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { dataNascimento: form.birthDate, horizonteIdade: form.horizonAge, idadesAlvo: form.targetAges },
    });
  const inssValues = {
    anosContribuicaoAtual: String(form.inss.contributionYears),
    salarioContribuicaoAtual: toDbMoney(form.inss.contributionSalary),
    dataReferencia: today,
    beneficioEstimado: toDbMoney(form.inss.benefit),
    idadeInicioBeneficio: form.inss.startAge,
    crescimentoRealMinimo: String(form.inss.realGrowth),
  };
  await db.insert(inssSettings).values({ userId, ...inssValues }).onConflictDoUpdate({ target: inssSettings.userId, set: inssValues });

  // Substituição total das listas (neon-http não tem transação; falha parcial é refeita pelo usuário reenviando).
  await db.delete(accounts).where(eq(accounts.userId, userId));
  if (form.accounts.length)
    await db.insert(accounts).values(
      form.accounts.map((a) => ({
        userId, nome: a.name, assetClassId: a.classId, instituicao: a.institution ?? null,
        saldoAtual: toDbMoney(a.balance), custoBase: toDbMoney(a.costBasis), dataReferencia: today,
        incluirNaAposentadoria: a.included,
      })),
    );
  await db.delete(contributionPlans).where(eq(contributionPlans.userId, userId));
  if (form.contribution.monthly > 0)
    await db.insert(contributionPlans).values({
      userId, valorMensal: toDbMoney(form.contribution.monthly), reajusteRealAnual: String(form.contribution.realGrowth),
      dataInicio: today, alocacao: {},
    });
  await db.delete(expenseGoals).where(eq(expenseGoals.userId, userId));
  await db.insert(expenseGoals).values(
    form.expenses.map((e) => ({
      userId, categoria: e.category, valorMensal: toDbMoney(e.monthly), idadeInicio: e.startAge, idadeFim: e.endAge,
      inflacaoExtraAnual: String(e.extraInflation),
    })),
  );
  const existing = await db.select({ id: assumptionSets.id }).from(assumptionSets)
    .where(and(eq(assumptionSets.userId, userId), eq(assumptionSets.versao, 1))).limit(1);
  if (existing.length === 0)
    await db.insert(assumptionSets).values({
      userId, nome: "Premissas base", versao: 1, inflacaoLongoPrazo: String(DEFAULT_INFLATION),
      observacoes: "Inflação: referência Boletim Focus (BCB). Atualize periodicamente.",
    });
}
