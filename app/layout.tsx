import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aposentadoria",
  description: "Simulador e gestor de aposentadoria",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-zinc-900">
        <main className="mx-auto max-w-5xl p-6">{children}</main>
        <footer className="mx-auto max-w-5xl border-t p-6 text-xs text-zinc-500">
          Simulação educativa baseada em premissas. Não constitui recomendação de investimento.
          Confira o benefício oficial no Meu INSS.
        </footer>
      </body>
    </html>
  );
}
