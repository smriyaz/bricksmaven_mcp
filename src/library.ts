import { readFile, readdir, mkdir, writeFile, rename, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SiteHttp } from "./http.js";
import { LIBRARY, parseLibrary } from "./parser.js";
import { renameClasses } from "./rename.js";
import type { Card, Entry, ContentType, Variant } from "./types.js";
export const ROOT = fileURLToPath(new URL("../",import.meta.url));
export const CACHE = resolve(process.env.BRICKSMAVEN_CACHE_DIR || join(ROOT,".cache/bricksmaven"));
interface Catalog { version: 1; source: "http" | "saved-html"; synced_at: string; pages_read: number; total_pages: number; complete: boolean; items: Entry[] }
interface Query { query?: string; category?: string; type?: ContentType; variant?: Variant; limit?: number; offset?: number }
export class Library {
  private catalog?: Catalog;
  private syncPromise?: Promise<Catalog>;
  private pageCache = new Map<string,Card[]>();
  constructor(readonly http = new SiteHttp(), readonly cache = CACHE, readonly htmlDir = process.env.BRICKSMAVEN_HTML_DIR) {}
  async status() {
    const catalog = await this.readCatalog();
    return { credentials_configured:this.http.configured, saved_html_configured:Boolean(this.htmlDir), cache_dir:this.cache, catalog:catalog ? { ...catalog,items:undefined,item_count:catalog.items.length } : null };
  }
  private async readCatalog() {
    if (this.catalog) return this.catalog;
    try {
      const c = JSON.parse(await readFile(join(this.cache,"catalog.json"),"utf8")) as Catalog;
      if (c.version !== 1 || !Array.isArray(c.items)) throw new Error("Unsupported catalog format");
      this.catalog = c;
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    return this.catalog;
  }
  async sync(maxPages = 100) {
    if (!Number.isInteger(maxPages) || maxPages<1 || maxPages>500) throw new Error("max_pages must be 1..500");
    if (!this.syncPromise) this.syncPromise = this.doSync(maxPages).finally(()=>{this.syncPromise=undefined;});
    return this.syncPromise;
  }
  private async doSync(maxPages:number):Promise<Catalog> {
    const entries = new Map<string,Entry>();
    const pendingCache = new Map<string,Card[]>();
    let read=0, total=0, complete=false;
    if (this.htmlDir) {
      const files = (await readdir(this.htmlDir)).filter(f=>/\.html?$/i.test(f)).sort();
      if (!files.length) throw new Error("No saved .html files found in BRICKSMAVEN_HTML_DIR");
      for (const file of files.slice(0,maxPages)) {
        const parsed = parseLibrary(await readFile(resolve(this.htmlDir,file),"utf8"));
        if (!parsed.cards.length) throw new Error(`Saved HTML contains no library cards: ${file}`);
        read++; total=Math.max(total,...parsed.pages);
        for (const c of parsed.cards) { entries.set(c.entry.id,c.entry);pendingCache.set(c.entry.id,[c]); }
      }
      // Saved pages may be filtered or duplicated; never claim full-site coverage.
      complete=false;
    } else {
      if (this.http.configured) await this.http.login();
      const first = parseLibrary(await this.http.html(LIBRARY));
      if (!first.cards.length) throw new Error("No library cards found. Site structure, login, or bot protection may have changed");
      total = Math.max(...first.pages);
      const signatures = new Set<string>();
      for (let page=1; page<=Math.min(total,maxPages); page++) {
        const url = page===1 ? LIBRARY : `${LIBRARY}?_pagination=${page}`;
        const parsed = page===1 ? first : parseLibrary(await this.http.html(url),url);
        if (!parsed.cards.length) throw new Error(`No cards found on page ${page}; previous catalog preserved`);
        const signature = parsed.cards.map(c=>c.entry.id).sort().join(",");
        if (signatures.has(signature)) throw new Error(`Pagination repeated page ${page}; previous catalog preserved`);
        signatures.add(signature);
        total=Math.max(total,...parsed.pages);
        for (const c of parsed.cards) entries.set(c.entry.id,c.entry);
        // Keep membership payloads in memory only, never in the public catalog.
        pendingCache.set(url,parsed.cards);
        read++;
        console.error(`[bricksmaven] Indexed page ${page}/${total}`);
      }
      complete=read===total;
    }
    const catalog:Catalog = { version:1,source:this.htmlDir?"saved-html":"http",synced_at:new Date().toISOString(),pages_read:read,total_pages:total,complete,items:[...entries.values()] };
    await mkdir(this.cache,{recursive:true,mode:0o700});
    const temp=join(this.cache,`catalog-${crypto.randomUUID()}.tmp`);
    await writeFile(temp,JSON.stringify(catalog,null,2),{mode:0o600});
    await rename(temp,join(this.cache,"catalog.json"));
    this.catalog=catalog; this.pageCache=pendingCache;
    return catalog;
  }
  async query(q:Query = {}) {
    const c = await this.readCatalog() ?? await this.sync();
    const keywords=(q.query??"").toLowerCase().split(/[\s-]+/).filter(Boolean);
    const filtered=c.items.map(entry=>({entry,score:keywords.filter(k=>`${entry.slug} ${entry.title} ${entry.category}`.toLowerCase().includes(k)).length}))
      .filter(({entry,score})=>(!keywords.length || score>0) && (!q.type || entry.type===q.type) && (!q.category || entry.category.toLowerCase()===q.category.toLowerCase()) && (!q.variant || entry.variants.includes(q.variant)))
      .sort((a,b)=>b.score-a.score || a.entry.title.localeCompare(b.entry.title,undefined,{numeric:true}));
    const offset=q.offset??0, limit=q.limit??20;
    const items = await Promise.all(filtered.slice(offset,offset+limit).map(async ({entry})=>{
      const snapshot_path=join(this.cache,"previews",`${entry.id}.jpg`);
      try {await access(snapshot_path);return {...entry,snapshot_path};} catch {return entry;}
    }));
    return { total:filtered.length,offset,limit,catalog_complete:c.complete,pages_read:c.pages_read,total_pages:c.total_pages,synced_at:c.synced_at,items };
  }
  async categories() {
    const c=await this.readCatalog()??await this.sync();
    const counts=new Map<string,{category:string;type:ContentType;count:number}>();
    for (const e of c.items) { const row=counts.get(e.category)??{category:e.category,type:e.type,count:0};row.count++;counts.set(e.category,row); }
    return {catalog_complete:c.complete,items:[...counts.values()].sort((a,b)=>a.category.localeCompare(b.category))};
  }
  private async find(slug:string) {
    const c=await this.readCatalog()??await this.sync();
    const e=c.items.find(e=>e.slug===slug || e.id===slug);
    if (!e) throw new Error(`Unknown item: ${slug}. Search or sync the catalog first`);
    return e;
  }
  async export(slug:string, variant:Variant="acss", prefix?:string, originalPrefix?:string) {
    let e=await this.find(slug);
    // Hydrate saved HTML on restart without requiring a remote login.
    if (this.htmlDir && !this.pageCache.size) { await this.sync();e=await this.find(slug); }
    let card=[...this.pageCache.values()].flat().find(c=>c.entry.id===e.id);
    if (!card?.payloads[variant] && !this.htmlDir) {
      await this.http.login();
      const url=e.library_url.split("#")[0]!;
      let parsed=parseLibrary(await this.http.html(url),url);
      card=parsed.cards.find(c=>c.entry.id===e.id);
      if (!card?.payloads[variant]) {
        // Only one refresh; a genuinely missing variant must not be fabricated.
        await this.http.login(true);
        parsed=parseLibrary(await this.http.html(url),url);
        card=parsed.cards.find(c=>c.entry.id===e.id);
      }
      this.pageCache.set(url,parsed.cards);
    }
    const payload=card?.payloads[variant];
    if (!payload) throw new Error(`No valid ${variant.toUpperCase()} copy payload for ${e.title}. Available: ${Object.keys(card?.payloads??{}).join(", ")||"none"}. Check membership, saved HTML freshness, or choose another variant`);
    const renamed=prefix ? renameClasses(payload,e.slug,prefix,originalPrefix) : undefined;
    const json=renamed?.json??structuredClone(payload);
    return { ...e,variant,element_count:json.content.length,global_class_count:json.globalClasses?.length??0,renamed:Boolean(renamed),...(renamed?{original_prefix:renamed.original_prefix,new_prefix:renamed.new_prefix,class_map:renamed.class_map}:{}),bricks_json:json };
  }
  async syncPreviews({limit=20,offset=0,force=false,type}:{limit?:number;offset?:number;force?:boolean;type?:ContentType}) {
    const {items,total}=await this.query({limit,offset,type});
    const results:Array<{slug:string;path?:string;error?:string}>=[];
    for (const item of items) {
      if (!item.thumbnail_url) {results.push({slug:item.slug,error:"No thumbnail URL"});continue;}
      const path=join(this.cache,"previews",`${item.id}.jpg`);
      try {
        if (!force) {try {await readFile(path); results.push({slug:item.slug,path});continue;}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}}
        // No authentication cookies are sent to media hosts.
        const r=await fetch(item.thumbnail_url,{redirect:"error",signal:AbortSignal.timeout(30_000)});
        if (!r.ok || !r.headers.get("content-type")?.startsWith("image/")) throw new Error("Thumbnail unavailable or not an image");
        const data=Buffer.from(await r.arrayBuffer());
        if (data.length>10*1024*1024) throw new Error("Thumbnail exceeds 10 MiB");
        await mkdir(join(this.cache,"previews"),{recursive:true,mode:0o700});
        await writeFile(path,data,{mode:0o600}); results.push({slug:item.slug,path});
      } catch {results.push({slug:item.slug,error:"Thumbnail download failed"});}
    }
    return {total,offset,processed:results.length,results};
  }
}
