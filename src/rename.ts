import type { BricksJson } from "./types.js";
const validPrefix = /^[a-z][a-z0-9_-]{0,79}$/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function renameClasses(input: BricksJson, slug: string, prefix: string, explicitRoot?: string) {
  if (!validPrefix.test(prefix)) throw new Error("Prefix must start with a lowercase letter and contain only a-z, 0-9, _ or - (max 80)");
  const classes = input.globalClasses ?? [];
  // Bricksmaven's shared intro, button and framework classes must remain shared.
  const expected = `bm-${slug}`;
  const belongs = (name: string, root: string) => name === root || name.startsWith(`${root}__`) || name.startsWith(`${root}-`);
  const topIds = new Set(input.content.filter(e=>e.parent===0 || e.parent==="0").flatMap(e=>Array.isArray(e.settings._cssGlobalClasses)?e.settings._cssGlobalClasses:[]));
  const rootCandidates = classes.filter(c=>topIds.has(c.id) && /-\d+$/.test(c.name) && classes.some(other=>other.name!==c.name && belongs(other.name,c.name)));
  const root = explicitRoot ?? (classes.some(c=>belongs(c.name,expected)) ? expected : rootCandidates.length===1 ? rootCandidates[0]!.name : undefined);
  if (!root || !classes.some(c=>belongs(c.name,root))) throw new Error("Cannot identify the layout root safely; supply original_prefix from its globalClasses");
  const isOwned = (s: string) => s === root || s.startsWith(`${root}__`) || s.startsWith(`${root}--`) || s.startsWith(`${root}-`);
  const names = new Map(classes.filter(c=>isOwned(c.name)).map(c=>[c.name, prefix+c.name.slice(root.length)]));
  const untouched = new Set(classes.filter(c=>!names.has(c.name)).map(c=>c.name));
  if ([...names.values()].some(n=>untouched.has(n))) throw new Error("Renamed class would collide with a shared class");
  // Exact selector tokens only. Never rewrite prose, URLs, IDs, or CSS variables.
  const regex = new RegExp(`\\.(${[...names.keys()].sort((a,b)=>b.length-a.length).map(escapeRe).join("|")})(?![a-zA-Z0-9_-])`, "g");
  const visit = (v: unknown, key = ""): unknown => {
    if (typeof v === "string" && /css|selector/i.test(key)) return v.replace(regex, (_, name:string)=>`.`+names.get(name));
    if (Array.isArray(v)) return v.map(x=>visit(x,key));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x,k)]));
    return v;
  };
  const json = visit(structuredClone(input)) as BricksJson;
  for (const c of json.globalClasses ?? []) if (names.has(c.name)) c.name = names.get(c.name)!;
  return { json, original_prefix: root, new_prefix: prefix, class_map: Object.fromEntries(names) };
}
