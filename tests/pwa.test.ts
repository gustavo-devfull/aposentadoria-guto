import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

/** Largura e altura de um PNG (cabeçalho IHDR). */
function pngSize(path: string) {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("manifest do PWA", () => {
  const m = manifest();
  it("tem o que o navegador exige para instalar", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name!.length).toBeLessThanOrEqual(14); // nome sob o ícone: lançadores mostram ~12–14 letras
    expect(m.display).toBe("standalone");
    expect(m.start_url!.startsWith("/")).toBe(true);
    expect(m.scope).toBe("/");
    expect(m.lang).toBe("pt-BR");
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("ícones existem em public/ com o tamanho declarado, incluindo um maskable de 512", () => {
    for (const icon of m.icons!) {
      const file = `public${icon.src}`;
      expect(existsSync(file), file).toBe(true);
      const [w, h] = icon.sizes!.split("x").map(Number);
      expect(pngSize(file)).toEqual({ w, h });
    }
    expect(m.icons!.some((i) => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
    expect(m.icons!.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
    expect(m.icons!.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  });
  it("atalhos apontam para telas reais", () => {
    for (const s of m.shortcuts!) expect(existsSync(`app${s.url}/page.tsx`), s.url).toBe(true);
  });
  it("ícone do iPhone (apple-touch) tem 180×180", () => {
    expect(pngSize("app/apple-icon.png")).toEqual({ w: 180, h: 180 });
  });
});

describe("service worker", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  it("pré-carrega a página offline e ela existe", () => {
    expect(sw).toContain('"/offline.html"');
    expect(existsSync("public/offline.html")).toBe(true);
    expect(readFileSync("public/offline.html", "utf8")).toContain("sem conexão");
  });
  it("nunca intercepta login/API nem métodos que alteram dados", () => {
    expect(sw).toContain('req.method !== "GET"');
    expect(sw).toContain('"/api/"');
  });
  it("só guarda em cache arquivos estáticos e ícones — não páginas com dados pessoais", () => {
    expect(sw).toContain("/_next/static/");
    expect(sw).toContain("/icons/");
    // a única resposta de navegação vinda do cache é a página offline
    expect(sw.match(/caches\.match\(/g)!.length).toBe(2);
  });
});
