"use client";

import { Button, Card } from "@/components/ui";

/** Erro ao renderizar uma página no servidor (em produção a mensagem real fica só nos logs; aqui vai o `digest`). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-semibold">Não foi possível carregar esta página</h1>
      <p className="text-sm text-muted">
        Se você acabou de atualizar o app, o banco pode estar sem uma migration. Aplique-a com <code>npm run db:migrate</code> (ou
        confira <code>DATABASE_URL</code> na Vercel) e tente de novo.
      </p>
      {error.digest && <p className="text-xs text-muted">Código do erro: <code>{error.digest}</code> (procure nos logs da Vercel)</p>}
      <Button onClick={reset}>Tentar de novo</Button>
    </Card>
  );
}
