// Gera os ícones do PWA a partir do logo (mesmo traço do cabeçalho). Uso: PW_CHROMIUM=/caminho/chromium node scripts/generate-icons.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const ACCENT = "#fa6900";
const glyph = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-12 -12)" fill="none" stroke="#1f1204" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>
  </g>`;
const svg = (rx, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rx}" fill="${ACCENT}"/>${glyph(scale)}</svg>`;

// "any": cantos arredondados (transparentes). "maskable"/apple: fundo cheio — o sistema aplica a máscara.
const rounded = svg(112, 14);
const full = svg(0, 12.5); // glifo dentro da zona segura (80%) do ícone maskable

writeFileSync("app/icon.svg", rounded);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ["--no-sandbox"] });
async function png(markup, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await png(rounded, 192, "public/icons/icon-192.png");
await png(rounded, 512, "public/icons/icon-512.png");
await png(full, 512, "public/icons/icon-maskable-512.png");
await png(full, 180, "app/apple-icon.png");
await browser.close();
console.log("ícones gerados");
