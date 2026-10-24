import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLibrary, trustedUrl, validateBricks } from "../src/parser.js";
const payload={content:[{id:"abc",name:"section",parent:0,children:[],settings:{}}],globalClasses:[],source:"bricksCopiedElements"};
const encoded=JSON.stringify(payload).replaceAll('"','&quot;');
const html=`<div class="block"><h3 class="block-head__title">How It Works 28</h3><a class="block-head__cta" href="#block-13925">Preview</a><img class="block-body__thumb" src="https://www.bricksmaven.com/thumb.jpg"><span class="block-footer__cta" data-value="${encoded}">Copy ACSS</span><span class="block-footer__cta" data-value="bad">Copy CF</span><iframe src="https://css.bricksmaven.com/template/howitwork-28/ "></iframe></div><a href="?_pagination=25">25</a>`;
test("actual title slug differs from iframe slug; HTML entities and trailing spaces are handled",()=>{
  const {cards,pages}=parseLibrary(html); const c=cards[0]!;
  assert.equal(c.entry.slug,"how-it-works-28");
  assert.equal(c.entry.preview_url,"https://css.bricksmaven.com/template/howitwork-28/");
  assert.deepEqual(c.payloads.acss,payload);assert.deepEqual(c.entry.variants,["acss"]);
  assert.equal(c.errors.length,1);assert.deepEqual(pages,[1,25]);
});
test("members-only absence is distinct from parse failure",()=>{
 const p=parseLibrary(html.replace(`data-value="${encoded}"`,"data-value"));
 assert.equal(p.cards[0]!.payloads.acss,undefined);assert.equal(p.cards[0]!.errors.length,1);
});
test("component classification and invalid payload validation",()=>{
 assert.equal(parseLibrary(html.replace("How It Works 28","Modal 12")).cards[0]!.entry.type,"component");
 assert.throws(()=>validateBricks({content:[{}]}));assert.throws(()=>validateBricks({content:[]}));
});
test("preview URLs reject arbitrary hosts, protocols, embedded credentials and ports",()=>{
 for(const u of ["https://evil.com/a","http://css.bricksmaven.com/a","https://bricksmaven.com.evil.com/a","https://user:pass@www.bricksmaven.com/a","https://www.bricksmaven.com:8080/a"])assert.equal(trustedUrl(u),undefined);
});

test("server-rendered lazy image placeholders resolve to real data-src thumbnails",()=>{
 const saved=html.replace('src="https://www.bricksmaven.com/thumb.jpg"','src="data:image/svg+xml,placeholder" data-src="https://www.bricksmaven.com/real.jpg"');
 assert.equal(parseLibrary(saved).cards[0]!.entry.thumbnail_url,"https://www.bricksmaven.com/real.jpg");
});
