-- Supabase expõe o schema public via API (PostgREST). Sem RLS, qualquer pessoa com a chave anon leria e gravaria estas tabelas.
-- RLS ativado SEM políticas = anon/authenticated não acessam nada. O app acessa o banco pelo servidor (role dona das tabelas,
-- que ignora RLS) e checa user_id em todas as queries.
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "asset_classes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assumption_sets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "auth_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contribution_pauses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contribution_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expense_goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "extra_contributions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "income_sources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inss_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "simulations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;
