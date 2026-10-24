# Validation — 25 October 2026

- TypeScript build: passed.
- Automated tests: 12 passed, 0 failed (`npm run check`).
- Real stdio MCP client: initialized, listed seven tools, and exported a fixture successfully. Covered in the automated suite.
- Public HTTP catalog crawl: 25/25 pages, 970 unique numeric block IDs; classified as 909 layouts and 61 components. Public pages exposed no valid members-only copy payloads.
- Authenticated Chrome HTML sample: 40 cards; 38 cards with three variants each; 114 exports and 114 rename operations succeeded without errors.
- Real thumbnail cache: downloaded Blog Section 25 image successfully, then confirmed its local `snapshot_path` in search output. This check caught and fixed server-rendered `data-src` lazy loading support.
- Local sample configuration: one saved Chrome HTML page, explicitly marked as incomplete coverage.
- Not verified: real username/password login, WordPress destination import/rendering, full-library authenticated exports beyond the saved page, and changes to a user's MCP client registration.

Private reference data is excluded from version control. The full public metadata crawl is stored locally in `private/public-cache/catalog.json`. The active sample catalog is in `.cache/bricksmaven/catalog.json`.
