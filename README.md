# Bricksmaven MCP

A local MCP server for finding and exporting Bricks Builder blocks from the [Bricksmaven Alpha Library](https://www.bricksmaven.com/alpha-library/). Inspired by [webshr/brixies-mcp](https://github.com/webshr/brixies-mcp), with a new adapter for Bricksmaven's catalog and copy controls.

Requires Node.js 22+. Uses the official MCP TypeScript SDK and stdio transport. No WordPress plugin is required. This server retrieves library data; inserting it into a WordPress site requires a separate Bricks editing integration or manual paste/import.

## Install locally

```sh
git clone https://github.com/smriyaz/bricksmaven_mcp.git
cd bricksmaven_mcp
npm ci
npm run build
cp -n .env.example .env
```

Edit `.env` if you need members-only exports or want to use saved, logged-in library HTML. The file is ignored by Git.

The MCP process waits for JSON-RPC on stdin; do not start `node dist/index.js` in a normal terminal unless you are testing an MCP client connection. Use the CLI below for terminal inspection. Logs go to stderr, leaving stdout reserved for MCP.

## Configure an MCP client

All examples below assume that the repository lives at `/absolute/path/to/bricksmaven_mcp`. Replace that path with the directory where you cloned it. The server loads `.env` from its own repository directory, so its configuration works independently of the editor's working directory.

### Cursor

Create either a project configuration at `.cursor/mcp.json`, or a global configuration at `~/.cursor/mcp.json` to use it in every Cursor workspace. Add:

```json
{
  "mcpServers": {
    "bricksmaven": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/bricksmaven_mcp/dist/index.js"]
    }
  }
}
```

Restart Cursor, then open **Customize → MCPs** and confirm that `bricksmaven` is enabled. If it does not connect, open **Output → MCP Logs** to see the server's error output. Cursor can also load an `envFile` for local stdio servers, but it is not needed here because the server already loads its repository-local `.env`. [Cursor's MCP configuration guide](https://prod.cursor.com/docs/mcp) documents the global and project configuration locations.

### Antigravity

Add the following to either `.agents/mcp_config.json` for one workspace or `~/.gemini/config/mcp_config.json` for all workspaces:

```json
{
  "mcpServers": {
    "bricksmaven": {
      "command": "node",
      "args": ["/absolute/path/to/bricksmaven_mcp/dist/index.js"],
      "cwd": "/absolute/path/to/bricksmaven_mcp"
    }
  }
}
```

In Antigravity IDE, open the agent panel's `…` menu, choose **MCP Servers → Manage MCP Servers → View raw config**, save the file, then refresh the server. In Antigravity CLI, use `/mcp` to inspect or reload the server. [Antigravity's MCP guide](https://antigravity.google/docs/mcp) describes these global and workspace configuration files.

### Visual Studio Code

Open the target project in VS Code and create `.vscode/mcp.json`. VS Code uses a different top-level key from Cursor and Antigravity:

```json
{
  "servers": {
    "bricksmaven": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/bricksmaven_mcp/dist/index.js"],
      "cwd": "/absolute/path/to/bricksmaven_mcp"
    }
  }
}
```

Alternatively, run **MCP: Add Server** from the Command Palette, choose **Command (stdio)**, supply `node` and the absolute `dist/index.js` path, then choose the workspace or user-profile destination. Use **MCP: List Servers** to start, restart, or view the server. This requires VS Code's AI/agent features to be enabled. [VS Code's MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) covers the `servers` schema and configuration destinations.

For a remote SSH, container, or Codespaces workspace, install Node.js, clone/build this repository, and create `.env` in the remote environment: the local stdio process runs where the VS Code agent runs.

### Credentials and access mode

For members-only Bricksmaven copy-payload exports, add these values to the local `.env` file rather than an editor configuration file:

```dotenv
BRICKSMAVEN_EMAIL=you@example.com
BRICKSMAVEN_PASSWORD=your-password
```

For the saved-HTML mode, set `BRICKSMAVEN_HTML_DIR` in that same `.env` file. Do not add `.env`, saved library pages, or exported blocks to source control.

## Access modes

**Direct HTTP, following the reference server's method.** Leave `BRICKSMAVEN_HTML_DIR` empty. Public catalog indexing does not require credentials. To fetch members-only copy JSON, set `BRICKSMAVEN_EMAIL` and `BRICKSMAVEN_PASSWORD`. The server uses WordPress's login form and an in-memory cookie jar, retaining cookies across redirects. Credentials are sent only to `https://www.bricksmaven.com`. Cookies and passwords are not written to the catalog cache.

Interactive login, CAPTCHA, or 2FA may prevent this method. The WordPress login implementation has mocked redirect/cookie tests; it has not been verified with this user's account password. Logged-in Chrome export data has been verified using the following mode.

**Saved Chrome HTML.** In your logged-in Chrome library, choose Save Page As → Web Page, HTML Only. Save library pages into one dedicated folder, then set:

```dotenv
BRICKSMAVEN_HTML_DIR=/absolute/path/to/saved-library-pages
```

Run `bricksmaven_sync` after saving more pages. This mode reads only that folder and works without account credentials or Chrome automation. It supports exports only for blocks and variants present in those saved files. It always reports `complete: false`, because saved files may be filtered, incomplete, stale, or duplicated. Use unique filenames when saving multiple pages.

For this workspace, `.env` already selects the private HTML sample saved from the logged-in Chrome session. It contains 40 cards and 114 valid variant payloads across 38 cards. Two cards had no copy payloads in the source page. This is a sample, not a full offline mirror of the library. `.env`, saved HTML, exports, and cache are git-ignored.

## Tools

| Tool | Purpose |
|---|---|
| `bricksmaven_status` | Show configuration and catalog coverage; never returns credentials |
| `bricksmaven_sync` | Refresh catalog, with `max_pages` safety bound |
| `bricksmaven_list` | List by exact category, layout/component type, and available variant |
| `bricksmaven_search` | Rank keyword matches in titles, categories, and slugs |
| `bricksmaven_categories` | Category counts for the current catalog |
| `bricksmaven_export` | Original Bricks clipboard JSON, optionally with class-prefix renaming |
| `bricksmaven_sync_previews` | Cache supplied thumbnail images in batches; search then returns local paths |

Examples of tool arguments:

```json
{"query":"hero", "type":"layout", "limit":10}
{"category":"Call To Action", "offset":0, "limit":20}
{"slug":"comparison-5", "variant":"acss", "prefix":"home-comparison"}
{"slug":"comparison-5", "variant":"cf"}
{"slug":"comparison-5", "variant":"atf"}
```

Export preserves the full clipboard object (`content`, `globalClasses`, `source`, `sourceUrl`, `version`, and any additional top-level data). The destination site must have the chosen CSS framework and relevant assets/plugins. The server does not execute Code elements or rewrite framework dependencies.

Search uses keyword overlap, not visual/semantic descriptions. Preview URLs come from actual card iframe `src` values: a title slug is not necessarily the preview slug. The live preview uses the iframe configured by the site for that block, regardless of the exported framework variant. Cached previews are original thumbnail images, not full-page screenshots. `bricksmaven_sync_previews` defaults to 20 items; advance `offset` to cache the next batch.

## Catalog behavior

Direct indexing reads all numbered `_pagination` pages discovered in the library, up to `max_pages` (default 100, maximum 500). A successful full crawl replaces the metadata catalog atomically. Partial crawls explicitly report coverage. Repeated pages, missing cards, network failures, or invalid structure abort a refresh and preserve the prior catalog. Requests run sequentially with a 45-second timeout per page.

Component type is inferred from Bricksmaven's visible component categories (tabs, slider, skills, modals, accordions/FAQ); other categories are classified as layouts. Available variants mean valid copy payloads were observed, so public-only metadata may show an empty variant list. No missing JSON is synthesized.

The catalog persists under `.cache/bricksmaven` by default; set `BRICKSMAVEN_CACHE_DIR` to override it. Copy payloads stay in process memory or in the explicitly saved private HTML files. Restarting saved-HTML mode rehydrates those files on export. Call sync to discover newly added or moved items; there is no automatic background crawl.

## Class renaming

Renaming finds `bm-<title-slug>` class families, or a unique numbered class attached to the root section with verified descendant classes. This handles title/root mismatches such as `Teams 24` → `bm-team-24` and `Call To Action 35` → `cta-35`. Ambiguous roots require the optional `original_prefix` argument.

Only the selected family is renamed, including matching CSS selectors. Shared classes such as `intro`, buttons, framework utilities, and unrelated class families retain their names. IDs, parent/children relationships, prose, media URLs, and CSS variables remain unchanged. The export reports a class map. IDs are not regenerated; a destination integration must manage ID collisions when inserting repeated instances. JavaScript selector literals are not rewritten automatically; inspect custom-script blocks before renaming those exports.

## Development and validation

```sh
npm run check
npm run inspect -- status
npm run inspect -- sync
npm run inspect -- search hero
node dist/cli.js export comparison-5 acss > comparison-5.json
```

Use the direct `node` command for redirected JSON; npm prints a script banner. Tests cover card parsing, unavailable/malformed variants, actual iframe URL handling, component classification, selector renaming, shared-class preservation, redirect cookie handling, cross-origin rejection, complete/partial pagination, failed refresh recovery, and MCP calls over both in-memory and real stdio transports.

See [implementation notes](docs/implementation-notes.md) for reference analysis and observed site details.
