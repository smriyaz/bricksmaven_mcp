import {test} from "node:test";
import assert from "node:assert/strict";
import {SiteHttp} from "../src/http.js";
test("redirects retain cookies and switch POST to GET without forwarding credentials",async()=>{
 const saved=globalThis.fetch;const requests:Array<{url:string;init?:RequestInit}>=[];
 globalThis.fetch=async(input,init)=>{requests.push({url:String(input),init});return requests.length===1?new Response(null,{status:302,headers:{location:"/alpha-library/","set-cookie":"wordpress_logged_in_test=ok; Path=/; Secure"}}):new Response("ok");};
 try {
  await new SiteHttp().request("https://www.bricksmaven.com/wp-login.php",{method:"POST",body:"pwd=secret"});
  assert.equal(requests.length,2);assert.equal(requests[1]!.init!.method,"GET");assert.equal(requests[1]!.init!.body,undefined);
  assert.match(new Headers(requests[1]!.init!.headers).get("cookie")!,/wordpress_logged_in_test=ok/);
 }finally{globalThis.fetch=saved;}
});
test("cross-origin redirect is rejected before any second request",async()=>{
 const saved=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>{count++;return new Response(null,{status:307,headers:{location:"https://evil.example/collect"}});};
 try{await assert.rejects(()=>new SiteHttp().request("https://www.bricksmaven.com/wp-login.php",{method:"POST",body:"pwd=secret"}),/outside Bricksmaven/);assert.equal(count,1);}finally{globalThis.fetch=saved;}
});
