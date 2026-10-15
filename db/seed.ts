import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { assetClasses, assumptionSets, inssSettings, profiles, users } from "./schema";
import { DEFAULT_ASSET_CLASSES, DEFAULT_INFLATION } from "../lib/engine/scenarios";

/** Uso: SEED_USER_EMAIL=voce@email.com npm run db:seed (o usuário precisa ter feito login uma vez). */
async function main() {
  const email = process.env.SEED_USER_EMAIL;
  if (!email) throw new Error("Defina SEED_USER_EMAIL");
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Usuário ${email} não encontrado — faça login uma vez antes`);
  const userId = user.id;

  await db.insert(profiles).values({ userId, dataNascimento: "1975-01-01", horizonteIdade: 95, idadesAlvo: [60, 65] }).onConflictDoNothing();
  await db
    .insert(inssSettings)
    .values({
      userId,
      anosContribuicaoAtual: "23",
      salarioContribuicaoAtual: "1621.00",
      dataReferencia: new Date().toISOString().slice(0, 10),
      beneficioEstimado: "1621.00",
      idadeInicioBeneficio: 65,
      crescimentoRealMinimo: "0",
    })
    .onConflictDoNothing();

  await db.insert(assetClasses).values(
    DEFAULT_ASSET_CLASSES.map((c) => ({
      userId,
      nome: c.name,
      retornoRealPessimista: String(c.returns.pessimista),
      retornoRealBase: String(c.returns.base),
      retornoRealOtimista: String(c.returns.otimista),
      taxaRealContratada: c.contractedRealRate === undefined ? null : String(c.contractedRealRate),
      custoAnual: String(c.annualCost),
      regimeIr: c.taxRegime,
      volatilidade: String(c.volatility),
    })),
  );
  await db.insert(assumptionSets).values({
    userId, nome: "Premissas base", versao: 1, inflacaoLongoPrazo: String(DEFAULT_INFLATION),
    observacoes: "Inflação de longo prazo: referência Boletim Focus (BCB). Atualize periodicamente.",
  });
  console.log("Seed concluído para", email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
