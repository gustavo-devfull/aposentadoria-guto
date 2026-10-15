CREATE TYPE "public"."categoria_gasto" AS ENUM('essencial', 'discricionario', 'saude');--> statement-breakpoint
CREATE TYPE "public"."cenario" AS ENUM('pessimista', 'base', 'otimista');--> statement-breakpoint
CREATE TYPE "public"."metodo_retirada" AS ENUM('preservar_capital', 'consumir_ate_horizonte', 'taxa_fixa');--> statement-breakpoint
CREATE TYPE "public"."ordem_resgate" AS ENUM('proporcional', 'menor_ir_primeiro');--> statement-breakpoint
CREATE TYPE "public"."regime_ir" AS ENUM('renda_fixa_regressivo', 'acoes_15', 'isento', 'pgbl_regressivo', 'vgbl_regressivo', 'custom');--> statement-breakpoint
CREATE TYPE "public"."tipo_renda" AS ENUM('inss', 'aluguel', 'trabalho_parcial', 'renda_mais', 'outro');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome" text NOT NULL,
	"asset_class_id" uuid NOT NULL,
	"instituicao" text,
	"saldo_atual" numeric(18, 2) NOT NULL,
	"custo_base" numeric(18, 2) NOT NULL,
	"data_referencia" date NOT NULL,
	"incluir_na_aposentadoria" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome" text NOT NULL,
	"retorno_real_pessimista" numeric(9, 6) NOT NULL,
	"retorno_real_base" numeric(9, 6) NOT NULL,
	"retorno_real_otimista" numeric(9, 6) NOT NULL,
	"taxa_real_contratada" numeric(9, 6),
	"custo_anual" numeric(9, 6) DEFAULT '0' NOT NULL,
	"regime_ir" "regime_ir" NOT NULL,
	"aliquota_efetiva_custom" numeric(9, 6),
	"volatilidade" numeric(9, 6)
);
--> statement-breakpoint
CREATE TABLE "assumption_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome" text NOT NULL,
	"versao" integer NOT NULL,
	"inflacao_longo_prazo" numeric(9, 6) DEFAULT '0.035' NOT NULL,
	"cenario" "cenario" DEFAULT 'base' NOT NULL,
	"metodo_retirada" "metodo_retirada" DEFAULT 'consumir_ate_horizonte' NOT NULL,
	"ordem_resgate" "ordem_resgate" DEFAULT 'proporcional' NOT NULL,
	"taxa_retirada" numeric(9, 6),
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"motivo" text
);
--> statement-breakpoint
CREATE TABLE "contribution_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"valor_mensal" numeric(18, 2) NOT NULL,
	"reajuste_real_anual" numeric(9, 6) DEFAULT '0' NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date,
	"alocacao" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"categoria" "categoria_gasto" NOT NULL,
	"descricao" text,
	"valor_mensal" numeric(18, 2) NOT NULL,
	"idade_inicio" integer NOT NULL,
	"idade_fim" integer,
	"inflacao_extra_anual" numeric(9, 6) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extra_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"descricao" text,
	"valor" numeric(18, 2) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer,
	"recorrente_anual" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tipo" "tipo_renda" NOT NULL,
	"descricao" text,
	"valor_mensal_hoje" numeric(18, 2) NOT NULL,
	"idade_inicio" integer NOT NULL,
	"idade_fim" integer,
	"crescimento_real" numeric(9, 6) DEFAULT '0' NOT NULL,
	"tributavel" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inss_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"anos_contribuicao_atual" numeric(5, 2) DEFAULT '23' NOT NULL,
	"salario_contribuicao_atual" numeric(18, 2) DEFAULT '1621.00' NOT NULL,
	"data_referencia" date NOT NULL,
	"beneficio_estimado" numeric(18, 2) DEFAULT '1621.00' NOT NULL,
	"idade_inicio_beneficio" integer DEFAULT 65 NOT NULL,
	"crescimento_real_minimo" numeric(9, 6) DEFAULT '0' NOT NULL,
	"cenario_aumento_contribuicao" jsonb
);
--> statement-breakpoint
CREATE TABLE "monthly_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"saldos_por_conta" jsonb NOT NULL,
	"aporte_realizado" numeric(18, 2) DEFAULT '0' NOT NULL,
	"nota" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data_nascimento" date NOT NULL,
	"horizonte_idade" integer DEFAULT 95 NOT NULL,
	"idades_alvo" integer[] DEFAULT '{60,65}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome" text NOT NULL,
	"input" jsonb NOT NULL,
	"resultado_resumido" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_asset_class_id_asset_classes_id_fk" FOREIGN KEY ("asset_class_id") REFERENCES "public"."asset_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_classes" ADD CONSTRAINT "asset_classes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_sets" ADD CONSTRAINT "assumption_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_pauses" ADD CONSTRAINT "contribution_pauses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_plans" ADD CONSTRAINT "contribution_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_goals" ADD CONSTRAINT "expense_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_contributions" ADD CONSTRAINT "extra_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inss_settings" ADD CONSTRAINT "inss_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD CONSTRAINT "monthly_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "asset_classes_user_idx" ON "asset_classes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assumption_sets_user_nome_versao" ON "assumption_sets" USING btree ("user_id","nome","versao");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_snapshots_user_mes_ano" ON "monthly_snapshots" USING btree ("user_id","ano","mes");--> statement-breakpoint
CREATE INDEX "simulations_user_idx" ON "simulations" USING btree ("user_id");