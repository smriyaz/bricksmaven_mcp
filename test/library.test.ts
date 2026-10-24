import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {Library} from "../src/library.js";
import {SiteHttp} from "../src/http.js";
const card=(id:number)=>`<div class="block"><h3 class="block-head__title">Hero ${id}</h3><a class="block-head__cta" href="#block-${id}"></a></div><a href="?_pagination=3">3</a>`;
class FakeHttp extends SiteHttp {
 repeat=false;
 constructor(){super("","");}
 override async html(url:string){return card(this.repeat?1:Number(new URL(url).searchParams.get("_pagination")||1));}
}
test("full pagination, bounded coverage, and failed refresh preserving last good catalog",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"bm-catalog-"));
 try {
  const http=new FakeHttp(),lib=new Library(http,dir,"");
  const partial=await lib.sync(1);assert.equal(partial.complete,false);assert.equal(partial.items.length,1);
  const full=await lib.sync();assert.equal(full.complete,true);assert.equal(full.items.length,3);
  http.repeat=true;
  await assert.rejects(()=>lib.sync(),/Pagination repeated/);
  assert.equal((await lib.query()).total,3);
  assert.equal((await new Library(http,dir,"").query()).total,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});
