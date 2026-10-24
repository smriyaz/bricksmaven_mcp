import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({path:fileURLToPath(new URL("../.env",import.meta.url)),quiet:true});
const { Library }=await import("./library.js");
const lib=new Library();
const [command,arg]=process.argv.slice(2);
try {
  let value;
  switch(command) {
    case "sync": {const c=await lib.sync(arg?Number(arg):100); value={...c,items:undefined,item_count:c.items.length};break;}
    case "previews": value=await lib.syncPreviews({limit:arg?Number(arg):20});break;
    case "search": value=await lib.query({query:arg??"hero"});break;
    case "export": value=await lib.export(arg??"",process.argv[4] as "acss"|"cf"|"atf"||"acss");break;
    default: value=await lib.status();
  }
  console.log(JSON.stringify(value,null,2));
} catch(e) {console.error(e instanceof Error?e.message:"Request failed");process.exitCode=1;}
