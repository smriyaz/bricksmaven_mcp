# Reference analysis and adapter design

Studied every TypeScript source file in `webshr/brixies-mcp` at commit `eff5cb8f8b8f52ae2e10a0d555c23ad61e7d6d7e` on 25 October 2026 (Pacific/Auckland). The unmodified checkout is kept locally under git-ignored `reference/brixies-mcp` for comparison.

The repository README describes older list/get/rename tools. Its current entry point actually registers three tools: `brixies_search`, `brixies_export`, and `brixies_sync_previews`. It uses the official MCP SDK over stdio, Zod inputs, a WordPress login POST, Axios plus a cookie jar, XML sitemap discovery, Cheerio extraction from `p.card-component__json`, and local preview manifests/screenshots. Search counts keyword overlap. Export optionally renames class names.

The Bricksmaven implementation retains that overall approach: stdio MCP, HTTP with WordPress sessions, HTML parsing of existing copy data, cached catalog, search/export, optional renaming, and local previews. It is independently authored rather than a domain-name replacement.

| Concern | Brixies implementation | Bricksmaven evidence and implementation |
|---|---|---|
| Discovery | Layout, page, and element XML sitemaps | Alpha Library cards across numbered `_pagination` pages; 25 pages were advertised during inspection |
| Item identity | Slug from dedicated item URL | Numeric `#block-<post-id>` plus slug derived from visible title |
| JSON source | Hidden `p.card-component__json` | HTML-entity-encoded JSON in `.block-footer__cta[data-value]` |
| Framework | One returned copy payload | Explicit `Copy ACSS`, `Copy CF`, `Copy ATF` controls; validated separately |
| Preview | Constructed URL under acss.brixies.co | Actual `.block iframe[src]`, e.g. `how-it-works-28` previews at `/template/howitwork-28/` |
| Auth | Email/password, wp-login.php, cookie jar | Same HTTP approach offered; authenticated Chrome HTML provides a tested alternative without extracting cookies/passwords |
| Rename | Renames matching global class names | Also updates selector-bearing CSS fields, protects shared classes, returns the class map |
| Preview cache | Playwright screenshots and manifest | Original site thumbnail download, bounded batches, local paths in search results |

The reference renamer selects a shortest non-categorized class and does not rewrite embedded custom CSS. That is unsafe for Bricksmaven, where short shared classes such as `intro` coexist with per-block classes and custom CSS explicitly names those block classes. Root detection here uses known naming or verified root-element class IDs and fails if ambiguous.

Chrome inspection found 40 cards on page 1, with 114 valid payloads across 38 cards (all three variants for those 38). `Comparison 4` and `How It Works 27` had no copy payloads in the observed logged-in page. Their absence is reported rather than substituted from another block. Comparison 5 contains 89 elements and 20 global classes in each of the observed variants. Real sample HTML and exported payloads remain in the private, ignored folder.

The server never writes to the source or a destination WordPress site, modifies the user's Chrome settings, reads Chrome's cookie database, or registers itself in a client's global configuration. The included MCP configuration is ready to adapt to the user's chosen client.
