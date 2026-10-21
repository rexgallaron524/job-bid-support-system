# Implementation status

## Implemented

- Private, authenticated job CRUD with database-enforced per-user URL uniqueness.
- URL cleaning, company suggestions, job descriptions, notes, salary, work arrangement, and deadlines.
- Application status transitions, preserved application timestamps, and explicit undo.
- Authenticated PDF/DOCX upload, download, replacement, and deletion.
- Streaming upload limits and optimistic attachment updates for concurrent tabs.
- Responsive overview, applications list, deadline view, document library, account settings, dark/light themes, and accessible dialogs.

## Verified

- Dependency installation completed.
- TypeScript checking and production compilation passed.
- The initial local database migration applied successfully.
- Eight domain tests passed: normalization, distinct postings, invalid URLs, company suggestions, application timestamp invariants, valid calendar dates, document signatures, and UTC deadline labels.
- The compiled Worker passed a two-user integration test using the bundled Miniflare runtime with D1 and R2. It checks anonymous rejection, per-user duplicates, unauthorized job/file operations, forged file content, private downloads, status/date preservation, explicit undo, deletion, and cross-origin rejection. Run `node --import ./scripts/sites-env.mjs tests/run-api.mjs` after building.
- Installed and verified Microsoft's signed Visual C++ x64 runtime, required on this Windows machine.

## Pending

- Browser review and private publication.

The Wrangler production preview proxy accepts connections but does not finish its reload on this machine. API checks use the actual compiled Worker directly in Miniflare, avoiding that proxy. Browser interaction and provider sign-in have not been verified.

Authentication uses Sites-managed ChatGPT sign-in. D1 and R2 replace the earlier PostgreSQL/Prisma proposal to support integrated private hosting. Hosted access starts owner-private; additional visitors require an explicit access change.
