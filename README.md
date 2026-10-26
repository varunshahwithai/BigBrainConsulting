# BBC – Big Brain Consulting

Free consulting tools for small business owners.

- **Market Entry Simulator**: test price, demand, discounts and costs, size the market, score entry barriers, and get an Enter / Partner / Don't Enter call.
- **Operations Bottleneck Diagnoser**: a guided 8-step journey that finds the step holding a process back, explains why, prices the problem and compares fixes.

## How it fits together

| Folder / file | What it is |
|---|---|
| `public/` | The website as visitors get it: `index.html` (both tools), `privacy.html`, `admin.html` (private, password protected). |
| `functions/api/` | The back door (API): asks Gemini for the AI buttons, saves profiles and analyses, takes "Hire a team" requests, and feeds the admin page. |
| `src/` | The parts `public/index.html` is built from. Edit these, not `public/index.html`. |
| `tools/build.py` | Rebuilds `public/` from `src/`. Run `python3 tools/build.py`. |
| `site.json` | Owner name and contact email shown on the privacy page. |
| `wrangler.toml` | Cloudflare settings (database connection and limits). Secrets are set in the Cloudflare dashboard, never here. |

Hosting: Cloudflare Pages, connected to this repository, so every change pushed here goes live automatically.
