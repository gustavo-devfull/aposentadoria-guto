ALTER TABLE "assumption_sets" ADD COLUMN "salario_minimo" numeric(18, 2) DEFAULT '1621.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "assumption_sets" ADD COLUMN "teto_inss" numeric(18, 2) DEFAULT '8475.55' NOT NULL;--> statement-breakpoint
ALTER TABLE "assumption_sets" ADD COLUMN "classes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_goals" ADD COLUMN "degraus" jsonb DEFAULT '[]'::jsonb NOT NULL;