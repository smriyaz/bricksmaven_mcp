import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";
import { LIBRARY } from "./parser.js";
const ORIGIN = new URL(LIBRARY).origin;
export class SiteHttp {
  private jar = new CookieJar();
  private loginPromise?: Promise<void>;
  constructor(private email = process.env.BRICKSMAVEN_EMAIL, private password = process.env.BRICKSMAVEN_PASSWORD) {}
  get configured() { return Boolean(this.email && this.password); }
  // Redirects are manual so WordPress cookies on 302 responses are retained.
  async request(url: string, init: RequestInit = {}): Promise<Response> {
    for (let hop=0; hop<6; hop++) {
      if (new URL(url).origin !== ORIGIN) throw new Error("Refusing to forward account requests outside Bricksmaven");
      const headers = new Headers(init.headers);
      headers.set("User-Agent", "Bricksmaven-MCP/0.1 (+local licensed library client)");
      headers.set("Accept", "text/html,application/xhtml+xml");
      const cookie = await this.jar.getCookieString(url);
      if (cookie) headers.set("Cookie", cookie);
      const r = await fetch(url, {...init,headers,redirect:"manual",signal:AbortSignal.timeout(45_000)});
      for (const c of r.headers.getSetCookie()) await this.jar.setCookie(c,url);
      if ([301,302,303,307,308].includes(r.status)) {
        const next = r.headers.get("location");
        if (!next) throw new Error("Redirect has no destination");
        url = new URL(next,url).href;
        if (r.status===303 || ((r.status===301 || r.status===302) && init.method==="POST")) init = {method:"GET"};
        await r.body?.cancel();
        continue;
      }
      if (!r.ok) { await r.body?.cancel(); throw new Error(`Bricksmaven returned HTTP ${r.status}`); }
      return r;
    }
    throw new Error("Too many Bricksmaven redirects");
  }
  async login(force = false): Promise<void> {
    if (!this.configured) throw new Error("Members-only export needs BRICKSMAVEN_EMAIL and BRICKSMAVEN_PASSWORD, or HTML saved from your logged-in Chrome library in BRICKSMAVEN_HTML_DIR");
    if (force) this.loginPromise = undefined;
    if (!this.loginPromise) this.loginPromise = this.doLogin().catch(e=>{this.loginPromise=undefined;throw e;});
    return this.loginPromise;
  }
  private async doLogin() {
    const url = `${ORIGIN}/wp-login.php`;
    const $ = cheerio.load(await (await this.request(url)).text());
    if (!$("form#loginform").length) throw new Error("WordPress login form unavailable; use saved Chrome HTML if the site requires interactive login");
    const body = new URLSearchParams();
    $("form#loginform input[type=hidden]").each((_,e)=>{const name=$(e).attr("name");if(name)body.set(name,$(e).attr("value")??"");});
    body.set("log",this.email!); body.set("pwd",this.password!); body.set("redirect_to",LIBRARY); body.set("testcookie","1"); body.set("wp-submit","Log In");
    await this.jar.setCookie("wordpress_test_cookie=WP+Cookie+check; Path=/; Secure",ORIGIN);
    const r = await this.request(url,{method:"POST",body,headers:{Referer:url}});
    await r.body?.cancel();
    if (!(await this.jar.getCookies(ORIGIN)).some(c=>c.key.startsWith("wordpress_logged_in"))) throw new Error("WordPress login failed. Check credentials or use saved Chrome HTML for interactive/2FA login");
  }
  async html(url: string) { return (await this.request(url)).text(); }
}
