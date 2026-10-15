import { date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Valores monetários: numeric(18,2). Taxas (fração, ex.: 0.035 = 3,5%): numeric(9,6). */
export const money = (name: string) => numeric(name, { precision: 18, scale: 2 });
export const rate = (name: string) => numeric(name, { precision: 9, scale: 6 });

// ---------------------------------------------------------------------------
// Auth.js (tabelas de autenticação).
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Modelo simples: um plano por usuário + cenários salvos para comparar.
// ---------------------------------------------------------------------------
export const plans = pgTable("plans", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dataNascimento: date("data_nascimento").notNull(),
  investido: money("investido").notNull().default("0"),
  aporteMensal: money("aporte_mensal").notNull().default("0"),
  taxaAnual: rate("taxa_anual").notNull().default("0.12"),
  inflacao: rate("inflacao").notNull().default("0.035"),
  inssBeneficio: money("inss_beneficio").notNull().default("1621.00"),
  inssIdade: integer("inss_idade").notNull().default(65),
  horizonteIdade: integer("horizonte_idade").notNull().default(90),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    input: jsonb("input").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("scenarios_user_idx").on(t.userId)],
);
