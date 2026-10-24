import { test } from "node:test";
import assert from "node:assert/strict";
import { renameClasses } from "../src/rename.js";
import type { BricksJson } from "../src/types.js";
const original:BricksJson={content:[{id:"s",name:"section",parent:0,children:[],settings:{_cssGlobalClasses:["a","c"],_cssCustom:".bm-hero-1 .bm-hero-1-card__title:hover { color: var(--bm-hero-1); } .bm-hero-10 {}",text:".bm-hero-1",url:"https://example.com/.bm-hero-1"}}],globalClasses:[{id:"a",name:"bm-hero-1",settings:[]},{id:"b",name:"bm-hero-1-card__title",settings:{_cssCustom:".bm-hero-1-card__title {}"}},{id:"c",name:"intro",settings:{}}]};
test("rename updates owned classes and selectors but preserves shared classes, IDs, variables, text and URLs",()=>{
 const before=structuredClone(original),{json}=renameClasses(original,"hero-1","home-hero");
 assert.equal(json.globalClasses![0]!.name,"home-hero");assert.equal(json.globalClasses![1]!.name,"home-hero-card__title");assert.equal(json.globalClasses![2]!.name,"intro");
 assert.equal(json.content[0]!.settings._cssCustom,".home-hero .home-hero-card__title:hover { color: var(--bm-hero-1); } .bm-hero-10 {}");
 assert.equal(json.content[0]!.settings.text,".bm-hero-1");assert.equal(json.content[0]!.settings.url,"https://example.com/.bm-hero-1");
 assert.deepEqual(json.content[0]!.settings._cssGlobalClasses,["a","c"]);assert.deepEqual(original,before);
});
test("unsafe detection, invalid prefixes and class collisions fail explicitly",()=>{
 assert.throws(()=>renameClasses({...original,globalClasses:[{id:"c",name:"intro",settings:{}}]},"nonexistent","home"));assert.throws(()=>renameClasses(original,"hero-1","1bad"));assert.throws(()=>renameClasses(original,"hero-1","intro"));
});

test("title/root naming discrepancies use verified section class IDs",()=>{
 const j=structuredClone(original);j.globalClasses![0]!.name="cta-35";j.globalClasses![1]!.name="cta-35__title";
 const renamed=renameClasses(j,"call-to-action-35","home-cta");
 assert.equal(renamed.original_prefix,"cta-35");assert.equal(renamed.json.globalClasses![1]!.name,"home-cta__title");
});
