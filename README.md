# Quantum Anniversary Game

A Quantum Fitness 28-year anniversary basketball game. Visitors enter their details, aim at four hidden discount hoops, take three shots, and keep their highest reward (5%, 10%, 15%, or 25% off). On phones and tablets the game expects landscape orientation. In-progress sessions persist in `localStorage` under `quantum-hoops-anniversary-session`.

## How a round works

1. **Lookup** — `POST /api/campaign/lookup` checks Google Sheets for the email. If the player already completed a round, their stored coupon is shown and play is skipped.
2. **Play** — Three shots at four shuffled hoops; the best landed discount wins.
3. **Complete** — `POST /api/campaign/complete` mints a WordPress coupon when `best > 0`, then appends the player row to the campaign Google Sheet.

```
Player → Vite game → Express API → Google Sheets
                              ↘ WordPress coupon (when best > 0)
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript
- Frontend: React 19, Vite, Tailwind CSS
- API: Express 5
- Campaign storage: Google Sheets
- Coupons: WordPress backend (HMAC-signed requests)
- API codegen: Orval from OpenAPI (`lib/api-spec`)

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env` at the repo root. The API loads it automatically.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `FRONTEND_API_SECRET` | Yes (coupons) | Shared secret for HMAC-signing WordPress coupon requests |
| `BACKEND_ENDPOINT` | Yes (coupons) | WordPress coupon API URL |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Yes (campaign) | Target spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes (campaign) | Service account email with sheet access |
| `GOOGLE_PRIVATE_KEY` | Yes (campaign) | Service account private key (`\n` for newlines is fine) |
| `GOOGLE_SHEETS_TAB` | No | Sheet tab name (default: `Campaign`) |
| `PORT` | Yes at runtime | Set when starting each process (see below) |

Postgres/Drizzle under `lib/db` is scaffold only; campaign data is stored in Google Sheets, not the database.

## Run locally

Start the API first (Vite proxies `/api` to port 8080):

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

Then the game:

```bash
pnpm dev
```

Or explicitly:

```bash
PORT=20033 BASE_PATH=/ pnpm --filter @workspace/quantum-anniversary-game run dev
```

Open `http://localhost:20033`.

### Other commands

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-spec run codegen   # regenerate API client + Zod schemas
```

Production preview of the game build:

```bash
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/quantum-anniversary-game run serve
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `artifacts/quantum-anniversary-game/` | React/Vite game (`src/App.tsx`) |
| `artifacts/api-server/` | Express API (lookup, complete, health) |
| `lib/api-spec/` | OpenAPI spec + Orval codegen |
| `lib/api-client-react/` | Generated React API client |
| `lib/api-zod/` | Generated Zod validators |
| `lib/db/` | Drizzle/Postgres scaffold (unused by campaign flow) |

## License

MIT
