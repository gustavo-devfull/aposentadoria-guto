CREATE TABLE "plans" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data_nascimento" date NOT NULL,
	"investido" numeric(18, 2) DEFAULT '0' NOT NULL,
	"aporte_mensal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"taxa_anual" numeric(9, 6) DEFAULT '0.12' NOT NULL,
	"inflacao" numeric(9, 6) DEFAULT '0.035' NOT NULL,
	"inss_beneficio" numeric(18, 2) DEFAULT '1621.00' NOT NULL,
	"inss_idade" integer DEFAULT 65 NOT NULL,
	"horizonte_idade" integer DEFAULT 90 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome" text NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scenarios_user_idx" ON "scenarios" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scenarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Converte o plano do modelo antigo: soma das contas incluídas, aporte vigente, inflação e salário mínimo da última versão das premissas.
INSERT INTO "plans" ("user_id", "data_nascimento", "investido", "aporte_mensal", "inflacao", "inss_beneficio", "inss_idade", "horizonte_idade")
SELECT
	p."user_id",
	p."data_nascimento",
	COALESCE((SELECT SUM(a."saldo_atual") FROM "accounts" a WHERE a."user_id" = p."user_id" AND a."incluir_na_aposentadoria"), 0),
	COALESCE((SELECT c."valor_mensal" FROM "contribution_plans" c WHERE c."user_id" = p."user_id" ORDER BY c."data_inicio" DESC LIMIT 1), 0),
	COALESCE((SELECT s."inflacao_longo_prazo" FROM "assumption_sets" s WHERE s."user_id" = p."user_id" ORDER BY s."versao" DESC LIMIT 1), 0.035),
	COALESCE((SELECT s."salario_minimo" FROM "assumption_sets" s WHERE s."user_id" = p."user_id" ORDER BY s."versao" DESC LIMIT 1), 1621.00),
	65,
	p."horizonte_idade"
FROM "profiles" p
ON CONFLICT ("user_id") DO NOTHING;
