import * as cheerio from "cheerio";
import type { BricksJson, Card, ContentType, ParsedPage, Variant } from "./types.js";
export const LIBRARY = "https://www.bricksmaven.com/alpha-library/";
const COMPONENTS = /^(?:tabs?|sliders?|skills?|modals?|accordions?(?:\s*\/\s*faq)?|faq)$/i;
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function trustedUrl(value: string | undefined, base = LIBRARY): string | undefined {
  if (!value?.trim()) return;
  try {
    const u = new URL(value.trim(), base);
    if (u.protocol === "https:" && (u.hostname === "bricksmaven.com" || u.hostname.endsWith(".bricksmaven.com")) && !u.username && !u.password && u.port === "") return u.href;
  } catch { /* absent or malformed URL */ }
}
export function validateBricks(value: unknown): BricksJson {
  if (!value || typeof value !== "object") throw new Error("Copy payload is not an object");
  const j = value as BricksJson;
  if (!Array.isArray(j.content) || !j.content.length || j.content.some(e => !e || typeof e.id !== "string" || typeof e.name !== "string" || !Array.isArray(e.children) || !e.settings || typeof e.settings !== "object")) throw new Error("Copy payload has invalid Bricks elements");
  if (j.globalClasses !== undefined && (!Array.isArray(j.globalClasses) || j.globalClasses.some(c => !c || typeof c.id !== "string" || typeof c.name !== "string"))) throw new Error("Copy payload has invalid globalClasses");
  return j;
}
export function parseLibrary(html: string, pageUrl = LIBRARY): ParsedPage {
  const $ = cheerio.load(html);
  const cards: Card[] = [];
  $(".block").each((_, el) => {
    const card = $(el);
    const title = card.find(".block-head__title").first().text().trim();
    const anchor = card.find(".block-head__cta").attr("href");
    const id = anchor?.match(/#block-(\d+)$/)?.[1];
    if (!title || !id) return;
    const category = title.replace(/\s+\d+$/, "").trim();
    const type: ContentType = COMPONENTS.test(category) ? "component" : "layout";
    const payloads: Card["payloads"] = {};
    const errors: string[] = [];
    card.find(".block-footer__cta").each((_, btn) => {
      const label = $(btn).text().trim().match(/^Copy\s+(ACSS|CF|ATF)\b/i)?.[1]?.toLowerCase() as Variant | undefined;
      const raw = $(btn).attr("data-value");
      if (!label || !raw?.trim()) return;
      try { payloads[label] = validateBricks(JSON.parse(raw)); }
      catch { errors.push(`Invalid ${label} payload for ${id}`); }
    });
    cards.push({ entry: {
      id, slug: slugify(title), title, category, type,
      library_url: `${pageUrl.split("#")[0]}#block-${id}`,
      preview_url: trustedUrl(card.find("iframe").first().attr("data-src")) ?? trustedUrl(card.find("iframe").first().attr("src")),
      thumbnail_url: trustedUrl(card.find(".block-body__thumb").attr("data-src")) ?? trustedUrl(card.find(".block-body__thumb").attr("src")),
      variants: Object.keys(payloads) as Variant[],
    }, payloads, errors });
  });
  const pages = new Set<number>([Number(new URL(pageUrl).searchParams.get("_pagination") || 1)]);
  $("a[href]").each((_, el) => {
    const href = trustedUrl($(el).attr("href"));
    if (!href) return;
    const u = new URL(href);
    const p = Number(u.searchParams.get("_pagination"));
    if (u.pathname === "/alpha-library/" && Number.isInteger(p) && p > 0 && p <= 500) pages.add(p);
  });
  return { cards, pages: [...pages].sort((a,b) => a-b) };
}
