# Quantum Hoops Anniversary Game

A playful Quantum.lk anniversary basketball game where visitors enter their details, aim at four discount hoops, take three shots, and keep their highest reward.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/quantum-anniversary-game run dev` — run the anniversary game preview
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/quantum-anniversary-game/src/App.tsx` — game flow, player form, gameplay, persistence, and CSV campaign export
- `artifacts/quantum-anniversary-game/src/index.css` — Quantum-inspired visual tokens and responsive game styling
- `artifacts/quantum-anniversary-game/.replit-artifact/artifact.toml` — artifact preview and workflow metadata
- `artifacts/api-server/` — shared API server scaffold; the current game is frontend-only

## Architecture decisions

- The game is intentionally frontend-only for the first release so it works as a standalone campaign microsite.
- Player details and the in-progress session persist in local storage so a mobile refresh does not erase a round.
- Discount values live in one editable `HOOP_REWARDS` constant and are shuffled across the four hidden hoops for each new player; the final reward is always the highest landed discount across three attempts.
- A release only wins when it is close enough to a hoop; releases outside the forgiving target zone are recorded as misses.
- Campaign export downloads a CSV with the full player record and shot history when Google Sheets is not connected.

## Product

- Collects name, email, and phone number before play.
- Provides mouse and touch aiming with an animated basketball shot into one of four discount hoops.
- Gives players exactly three chances and applies the best discount landed.
- Offers a campaign-ready CSV export containing contact details, shot results, best discount, and timestamp.

## User preferences

- Keep the experience aligned with Quantum.lk's fitness and anniversary campaign identity.

## Gotchas

- The game preview workflow supplies `PORT` and `BASE_PATH`; use `PORT=4173 BASE_PATH=/` when running a standalone production build locally.
- Google Sheets is not currently connected, so campaign data is exported through the in-app CSV fallback.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
