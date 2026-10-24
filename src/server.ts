import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Library } from "./library.js";
import { variants } from "./types.js";
export function createServer(library=new Library()) {
  const server=new McpServer({name:"bricksmaven-mcp-server",version:"0.1.0"});
  const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};
  const localWrite={...ro,readOnlyHint:false};
  const result=(value:Record<string,unknown>)=>({content:[{type:"text" as const,text:JSON.stringify(value,null,2)}],structuredContent:value});
  const safe=(fn:()=>Promise<Record<string,unknown>>)=>fn().then(result).catch((e:unknown)=>({isError:true,content:[{type:"text" as const,text:e instanceof Error?e.message:"Bricksmaven request failed"}]}));
  const paging={limit:z.number().int().min(1).max(100).default(20),offset:z.number().int().min(0).default(0)};
  const type=z.enum(["layout","component"]);
  const filters={...paging,type:type.optional(),category:z.string().max(100).optional(),variant:z.enum(variants).optional()};
  server.registerTool("bricksmaven_status",{description:"Check local configuration and catalog coverage without logging in or exposing credentials",inputSchema:{},annotations:ro},()=>safe(()=>library.status()));
  server.registerTool("bricksmaven_sync",{description:"Refresh catalog from paginated Alpha Library or saved Chrome HTML. Reports partial coverage; does not modify WordPress",inputSchema:{max_pages:z.number().int().min(1).max(500).default(100)},annotations:localWrite},({max_pages})=>safe(async()=>{const c=await library.sync(max_pages);return {...c,items:undefined,item_count:c.items.length};}));
  server.registerTool("bricksmaven_list",{description:"List indexed blocks with exact category, component/layout and available-variant filters",inputSchema:filters,annotations:ro},q=>safe(()=>library.query(q)));
  server.registerTool("bricksmaven_search",{description:"Rank blocks by title/category/slug keyword overlap. Returns source, thumbnail and actual iframe preview URLs, not visual semantic search",inputSchema:{query:z.string().trim().min(1).max(200),...filters},annotations:ro},q=>safe(()=>library.query(q)));
  server.registerTool("bricksmaven_categories",{description:"List category counts from the indexed catalog",inputSchema:{},annotations:ro},()=>safe(()=>library.categories()));
  server.registerTool("bricksmaven_export",{description:"Retrieve original Bricks clipboard JSON for ACSS, CF or ATF. Optional prefix renames layout-owned classes and CSS selector references. Preserves shared classes and IDs. Does not install content into WordPress",inputSchema:{slug:z.string().regex(/^[a-z0-9-]+$/).max(150),variant:z.enum(variants).default("acss"),prefix:z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/).optional(),original_prefix:z.string().regex(/^[a-z][a-z0-9_-]{0,149}$/).optional()},annotations:ro},({slug,variant,prefix,original_prefix})=>safe(()=>library.export(slug,variant,prefix,original_prefix)));
  server.registerTool("bricksmaven_sync_previews",{description:"Cache supplied library thumbnail images locally in bounded batches. Uses original thumbnails rather than full-page screenshots",inputSchema:{...paging,type:type.optional(),force:z.boolean().default(false)},annotations:localWrite},q=>safe(()=>library.syncPreviews(q)));
  return server;
}
