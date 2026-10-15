/**
 * Tabelas do modelo antigo (carteira por classe, metas de gasto, premissas, acompanhamento).
 * O app NÃO usa mais estas tabelas: os dados foram convertidos para `plans` na migration 0004.
 * Ficam declaradas só para o drizzle-kit não gerar DROPs automaticamente — remova-as
 * (e gere uma migration) quando decidir apagar os dados antigos.
 */
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { money, rate, users } from "./schema";

export interface ClassSnapshot {
  id: string;
  name: string;
  pessimista: number;
  base: number;
  otimista: number;
  contracted: number | null;
  annualCost: number;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const regimeIr = pgEnum("regime_ir", [
  "renda_fixa_regressivo",
  "acoes_15",
  "isento",
  "pgbl_regressivo",
  "vgbl_regressivo",
  "custom",
]);
export const cenario = pgEnum("cenario", ["pessimista", "base", "otimista"]);
export const metodoRetirada = pgEnum("metodo_retirada", [
  "preservar_capital",
  "consumir_ate_horizonte",
  "taxa_fixa",
]);
export const ordemResgate = pgEnum("ordem_resgate", ["proporcional", "menor_ir_primeiro"]);
export const tipoRenda = pgEnum("tipo_renda", ["inss", "aluguel", "trabalho_parcial", "renda_mais", "outro"]);
export const categoriaGasto = pgEnum("categoria_gasto", ["essencial", "discricionario", "saude"]);

// ---------------------------------------------------------------------------
// Domínio — toda tabela tem user_id; toda query deve filtrar por ele (db/queries).
// ---------------------------------------------------------------------------
export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dataNascimento: date("data_nascimento").notNull(),
  horizonteIdade: integer("horizonte_idade").notNull().default(95),
  idadesAlvo: integer("idades_alvo").array().notNull().default([60, 65]),
  /** Simulação usada como "plano" no acompanhamento mensal. */
  simulacaoReferenciaId: uuid("simulacao_referencia_id").references((): AnyPgColumn => simulations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inssSettings = pgTable("inss_settings", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  anosContribuicaoAtual: numeric("anos_contribuicao_atual", { precision: 5, scale: 2 }).notNull().default("23"),
  salarioContribuicaoAtual: money("salario_contribuicao_atual").notNull().default("1621.00"),
  dataReferencia: date("data_referencia").notNull(),
  beneficioEstimado: money("beneficio_estimado").notNull().default("1621.00"),
  idadeInicioBeneficio: integer("idade_inicio_beneficio").notNull().default(65),
  crescimentoRealMinimo: rate("crescimento_real_minimo").notNull().default("0"),
  /** { novoSalario, aPartirDe, ... } — ver lib/engine/inss.ts */
  cenarioAumentoContribuicao: jsonb("cenario_aumento_contribuicao"),
});

export const assetClasses = pgTable(
  "asset_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    retornoRealPessimista: rate("retorno_real_pessimista").notNull(),
    retornoRealBase: rate("retorno_real_base").notNull(),
    retornoRealOtimista: rate("retorno_real_otimista").notNull(),
    /** Se preenchida (ex.: IPCA+ já comprado), vale para os três cenários. */
    taxaRealContratada: rate("taxa_real_contratada"),
    custoAnual: rate("custo_anual").notNull().default("0"),
    regimeIr: regimeIr("regime_ir").notNull(),
    aliquotaEfetivaCustom: rate("aliquota_efetiva_custom"),
    volatilidade: rate("volatilidade"),
  },
  (t) => [index("asset_classes_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    assetClassId: uuid("asset_class_id").notNull().references(() => assetClasses.id),
    instituicao: text("instituicao"),
    saldoAtual: money("saldo_atual").notNull(),
    custoBase: money("custo_base").notNull(),
    dataReferencia: date("data_referencia").notNull(),
    incluirNaAposentadoria: boolean("incluir_na_aposentadoria").notNull().default(true),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const contributionPlans = pgTable("contribution_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  valorMensal: money("valor_mensal").notNull(),
  reajusteRealAnual: rate("reajuste_real_anual").notNull().default("0"),
  dataInicio: date("data_inicio").notNull(),
  dataFim: date("data_fim"),
  /** { [assetClassId]: percentual }, soma = 100 */
  alocacao: jsonb("alocacao").$type<Record<string, number>>().notNull(),
});

export const extraContributions = pgTable("extra_contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  descricao: text("descricao"),
  valor: money("valor").notNull(),
  mes: integer("mes").notNull(),
  /** null + recorrenteAnual=true => todo ano naquele mês (13º, PLR) */
  ano: integer("ano"),
  recorrenteAnual: boolean("recorrente_anual").notNull().default(false),
});

export const contributionPauses = pgTable("contribution_pauses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dataInicio: date("data_inicio").notNull(),
  dataFim: date("data_fim").notNull(),
  motivo: text("motivo"),
});

export const incomeSources = pgTable("income_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tipo: tipoRenda("tipo").notNull(),
  descricao: text("descricao"),
  valorMensalHoje: money("valor_mensal_hoje").notNull(),
  idadeInicio: integer("idade_inicio").notNull(),
  idadeFim: integer("idade_fim"),
  crescimentoReal: rate("crescimento_real").notNull().default("0"),
  tributavel: boolean("tributavel").notNull().default(false),
});

export const expenseGoals = pgTable("expense_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoria: categoriaGasto("categoria").notNull(),
  descricao: text("descricao"),
  valorMensal: money("valor_mensal").notNull(),
  idadeInicio: integer("idade_inicio").notNull(),
  idadeFim: integer("idade_fim"),
  inflacaoExtraAnual: rate("inflacao_extra_anual").notNull().default("0"),
  /** Degraus por idade: [{ fromAge, factor }] (ex.: gasto discricionário × 0,8 após os 75). */
  degraus: jsonb("degraus").$type<{ fromAge: number; factor: number }[]>().notNull().default([]),
});

/** Versionado: nunca sobrescrever; cada alteração cria nova linha com versao+1. */
export const assumptionSets = pgTable(
  "assumption_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    versao: integer("versao").notNull(),
    inflacaoLongoPrazo: rate("inflacao_longo_prazo").notNull().default("0.035"),
    cenario: cenario("cenario").notNull().default("base"),
    metodoRetirada: metodoRetirada("metodo_retirada").notNull().default("consumir_ate_horizonte"),
    ordemResgate: ordemResgate("ordem_resgate").notNull().default("proporcional"),
    taxaRetirada: rate("taxa_retirada"),
    observacoes: text("observacoes"),
    /** Premissas do INSS (editáveis, versionadas). */
    salarioMinimo: money("salario_minimo").notNull().default("1621.00"),
    tetoInss: money("teto_inss").notNull().default("8475.55"),
    /** Snapshot dos retornos/custos por classe nesta versão (base do diff). */
    classes: jsonb("classes").$type<ClassSnapshot[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assumption_sets_user_nome_versao").on(t.userId, t.nome, t.versao)],
);

export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    input: jsonb("input").notNull(),
    resultadoResumido: jsonb("resultado_resumido").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("simulations_user_idx").on(t.userId)],
);

export const monthlySnapshots = pgTable(
  "monthly_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mes: integer("mes").notNull(),
    ano: integer("ano").notNull(),
    /** { [accountId]: saldo } */
    saldosPorConta: jsonb("saldos_por_conta").$type<Record<string, string>>().notNull(),
    aporteRealizado: money("aporte_realizado").notNull().default("0"),
    nota: text("nota"),
  },
  (t) => [uniqueIndex("monthly_snapshots_user_mes_ano").on(t.userId, t.ano, t.mes)],
);

