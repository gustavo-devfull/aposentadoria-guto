ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "aportes_pontuais" jsonb DEFAULT '[]'::jsonb NOT NULL;
