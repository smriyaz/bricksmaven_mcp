import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {createServer} from "../src/server.js";
import {Library} from "../src/library.js";
import {SiteHttp} from "../src/http.js";
test("MCP handshake, tools/list, saved HTML sync/search/export/rename and missing variants",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"bm-mcp-test-"));
 const htmlDir=join(dir,"html");await mkdir(htmlDir);
 const data={content:[{id:"x",name:"section",parent:0,children:[],settings:{_cssCustom:".bm-hero-1 {}"}}],globalClasses:[{id:"g",name:"bm-hero-1",settings:[]}],version:"2.3",source:"bricksCopiedElements"};
 await writeFile(join(htmlDir,"one.html"),`<div class="block"><h3 class="block-head__title">Hero 1</h3><a class="block-head__cta" href="#block-12"></a><span class="block-footer__cta" data-value='${JSON.stringify(data)}'>Copy ACSS</span></div>`);
 const lib=new Library(new SiteHttp("",""),join(dir,"cache"),htmlDir);
 const server=createServer(lib),client=new Client({name:"test",version:"1.0"});
 const [a,b]=InMemoryTransport.createLinkedPair();
 try {
  await server.connect(a);await client.connect(b);
  assert.equal((await client.listTools()).tools.length,7);
  const call=async(name:string,args={})=>client.callTool({name,arguments:args});
  const sync=await call("bricksmaven_sync");assert.equal(sync.isError,undefined);
  const search=await call("bricksmaven_search",{query:"hero"});assert.equal((search.structuredContent as {total:number}).total,1);
  const exported=await call("bricksmaven_export",{slug:"hero-1",prefix:"home"});
  const j=exported.structuredContent as {bricks_json:typeof data};
  assert.equal(j.bricks_json.version,"2.3");assert.equal(j.bricks_json.globalClasses[0]!.name,"home");
  assert.equal((await call("bricksmaven_export",{slug:"hero-1",variant:"cf"})).isError,true);
  assert.equal((await call("bricksmaven_export",{slug:"../secret"})).isError,true);
  const restarted=new Library(new SiteHttp("",""),join(dir,"cache"),htmlDir);
  assert.equal((await restarted.export("hero-1")).element_count,1);
  const stdioClient=new Client({name:"stdio-test",version:"1.0"});
  const transport=new StdioClientTransport({command:process.execPath,args:["--import","tsx","src/index.ts"],env:{PATH:process.env.PATH??"",BRICKSMAVEN_HTML_DIR:htmlDir,BRICKSMAVEN_CACHE_DIR:join(dir,"cache")},stderr:"pipe"});
  try {await stdioClient.connect(transport);assert.equal((await stdioClient.listTools()).tools.length,7);const answer=await stdioClient.callTool({name:"bricksmaven_export",arguments:{slug:"hero-1"}});assert.equal(answer.isError,undefined);}finally{await stdioClient.close();}
 } finally {await client.close();await server.close();await rm(dir,{recursive:true,force:true});}
});
