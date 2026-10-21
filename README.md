# Jobbid

A private job application workspace with dark and light themes. Agreed scope and decisions are in [PLAN.md](PLAN.md).

## Features

- Managed ChatGPT sign-in and account isolation for jobs and files.
- Save, edit, search, filter, and delete opportunities.
- Database-enforced duplicate URLs per account, ignoring marketing parameters.
- Editable company suggestions from known job-board URLs and company domains.
- Job descriptions, notes, salary, location, work arrangement, and deadlines.
- Manual application workflow, preserved submission dates, status tracking, and undo.
- Private tailored PDF/DOCX resumes, up to 10 MB per job, with download and replacement.
- Dashboard, deadline view, resume library, responsive navigation, and appearance settings.

## Stack

TypeScript, React, Next-compatible Vinext, Drizzle, Cloudflare D1, and R2 through Sites. This hosting integration replaces the initially proposed PostgreSQL/Prisma infrastructure. Authentication and account recovery belong to the identity provider.

## Development

Environment: Node.js 22.13 or newer with npm, Git, a current browser, and internet access for installation. Wrangler is included as a project dependency and emulates D1/R2 locally; PostgreSQL, Docker, and Python are unnecessary.

On Windows, install the [Microsoft Visual C++ v14 Redistributable (x64)](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist), required by the local Worker emulator.

The current app requires no `.env` file, API keys, database connection string, or authentication secret. `DB` and `BUCKET` are managed platform bindings declared in `.openai/hosting.json`. Hosted sign-in uses Sites; local development uses a loopback-only sign-in simulation.

Run `node scripts/check-environment.mjs` to check this installation.

Requires Node.js 22.13 or newer. From this project directory:

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stormy_professor_monster.sql
npm run dev
```

Apply this migration once for a new local database. Run `npm run db:generate` only after schema changes. Local data is separate from hosted data. Development sign-in works on loopback and is excluded from production.

Never expose a raw local Worker publicly: hosted identity headers are trusted behind the Sites gateway.

## Verification

```sh
npx tsc --noEmit
node --experimental-strip-types --test tests/domain.test.mjs
npm run build
```

For API integration tests after building, run `node --import ./scripts/sites-env.mjs tests/run-api.mjs`. This starts the actual compiled Worker directly in the bundled Miniflare runtime, applies migrations to an isolated temporary database, tests two users, and disposes the runtime. It does not touch hosted or regular local data. Hosted test URLs are rejected.

## Limits

Company suggestions use URLs; descriptions are pasted manually. No automatic submissions or outbound emails. Each job has one replaceable resume. Appearance is saved per browser. Hosted access starts owner-private; additional users need an explicitly approved hosting access change. Application data stays separated by user.
