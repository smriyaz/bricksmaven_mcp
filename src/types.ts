export const variants = ["acss", "cf", "atf"] as const;
export type Variant = typeof variants[number];
export type ContentType = "layout" | "component";
export interface BricksJson {
  content: Array<{ id: string; name: string; parent: string | number; children: string[]; settings: Record<string, unknown>; [key: string]: unknown }>;
  globalClasses?: Array<{ id: string; name: string; settings: unknown; [key: string]: unknown }>;
  [key: string]: unknown;
}
export interface Entry {
  id: string;
  slug: string;
  title: string;
  category: string;
  type: ContentType;
  library_url: string;
  preview_url?: string;
  thumbnail_url?: string;
  variants: Variant[];
}
export interface Card { entry: Entry; payloads: Partial<Record<Variant, BricksJson>>; errors: string[] }
export interface ParsedPage { cards: Card[]; pages: number[] }
