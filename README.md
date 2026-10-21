# All in one place-job support

Private job application tracking for your own Windows 11 VPS. This version uses **Next.js on Node.js, React, TypeScript, PostgreSQL, and Drizzle**. It has its own email/password accounts; ChatGPT sign-in, Cloudflare D1/R2, and Sites deployment are removed from the application.

## What is included

See the [detailed functionality guide](docs/FUNCTIONALITIES.md) and [verification report](docs/VERIFICATION.md). For GitHub/VPS transfer and updates, use [GITHUB_VPS_SETUP.md](GITHUB_VPS_SETUP.md).

- Job URLs with duplicate checks per user and company suggestions.
- All applications pagination with 10, 20, or 50 rows per page; the choice is saved to your account.
- A detailed **My profile** page for manually entering your LinkedIn information and complete career history, with a `profile.txt` download for resume preparation.
- Visible, searchable opportunity IDs that also appear in the exported folder name and inside `jd.txt`.
- Job titles/descriptions, notes, deadlines, search, filters, status tracking, and tailored PDF/DOCX resumes.
- Manual applications: open the posting, apply there, then mark the job as applied.
- Export title + description to `D:\jobbid\{date}-{company}-{short-id}\jd.txt`, remembering your chosen root folder in this browser.
- Manager approval before new accounts can sign in.
- Manager dashboard: read all application data and download resumes; approve/reject/suspend/delete users. Other users' jobs cannot be edited/deleted individually by the manager.
- PostgreSQL stores accounts, session digests, job records, resume bytes, and signed-in theme preferences.
- User deletion cascades through their jobs, resume files, and sessions.
- Modern dark/light appearance, including account-synced preference.

## Local setup on Windows 11

1. Install **Node.js 22.13+** and **PostgreSQL 18**. PostgreSQL 17 should also support the schema; verification used PostgreSQL 18.6.
2. Start the PostgreSQL Windows service. In a PostgreSQL command prompt, create a dedicated role and database. The first command prompts for the new role's password:

   ```powershell
   createuser -U postgres --pwprompt --no-superuser --no-createdb --no-createrole job_support
   createdb -U postgres --owner=job_support job_support
   ```

3. Open PowerShell in this `jobbid` directory:

   ```powershell
   npm ci
   Copy-Item .env.example .env
   ```

4. Edit `.env`. Set `DATABASE_URL` to your actual database credentials, keep `APP_ORIGIN=http://localhost:3000` for local development, and choose `MANAGER_PATH` if desired. Percent-encode any special characters in the database URL password. Never commit `.env`.
5. Create the schema and your manager account:

   ```powershell
   npm run db:migrate
   npm run manager:create
   npm run doctor
   npm run dev
   ```

6. Open **http://localhost:3000** in Edge or Chrome and sign in with the manager account you just created. The manager dashboard link appears in your workspace.

The manager creation command is a server-side CLI with hidden password prompts. There is no public manager registration endpoint, default password, or seeded manager identity. If you already requested a normal account using the intended manager email, use a different email for the initial manager; the CLI intentionally refuses to overwrite an existing account.

If using the runtime previously downloaded for this workspace, before the commands above run:

```powershell
$env:Path = "D:\workspace\job bid system\.tools\bin;D:\workspace\job bid system\.tools\node-v22.23.3-win-x64;$env:Path"
```

The bundled runtime is optional; an installed Node.js works normally.

## Exporting descriptions for Codex

1. Create `D:\jobbid` on the Windows computer where your browser runs.
2. Save/open a job, then click **Export JD to folder**.
3. On your first export, select **D:\jobbid** in the directory picker and allow access. The app creates a subfolder and writes UTF-8 `jd.txt`, including the title and description.
4. Example: `D:\jobbid\2026-10-21-Acme-a1b2c3d4\jd.txt`.

The date is the job's UTC saved date; the short ID is stable. Invalid Windows filename characters in company names are replaced. Re-exporting the same job/company replaces its `jd.txt`. Changing the company changes the folder name. An export is a local copy; deleting the account does not remove it.

The same eight-character **Opportunity ID** is visible in the list and job details, can be copied or searched, and appears inside `jd.txt`. Existing IDs and export folder names are preserved.

Future exports reuse the selected folder, including after refreshing the page. Use **Change export folder** to select a different root; this changes the destination for future exports and does not move existing files. Your browser may ask you to renew permission. Cancelling a folder change keeps the previous selection.

The folder handle is remembered in IndexedDB on this browser, separately for each account. Changing browsers, devices, website origins, or clearing site data requires selecting the folder again. If browser storage is unavailable, the export can still work, but the selection may not be remembered. The app cannot inspect the absolute drive path, so select **D:\jobbid itself**, not a job subfolder.

The browser needs Edge/Chrome, a secure context (HTTPS or localhost), and your folder permission. It cannot silently select an arbitrary drive. The selected folder is on the **browser's computer**, even when the website runs on a remote VPS. No job text is sent to Codex automatically. Export-folder access needs no additional environment settings.

## Your master career profile

Open **My profile** from the navigation. Manually enter your LinkedIn information into contact/headline, summary, work experience, education, skills, projects, certifications/courses, languages, awards/publications, volunteering, career preferences, and additional-information sections. Experience and other career sections accept detailed text so you can keep your full history, dates, links, and accomplishments in one place.

Click **Save profile** to store it in PostgreSQL. The app warns before leaving with unsaved edits and rejects a save from an older tab when a newer version already exists. The manager can read profiles but cannot edit another user's profile. Deleting an account also deletes its stored master profile.

After saving, **Download profile TXT** downloads `profile.txt` through your browser's usual download flow. Use it together with an opportunity's `jd.txt` in your local Codex workspace, then upload the finished PDF/DOCX resume to that opportunity. The app does not import LinkedIn automatically or generate a resume.

## Updating an existing production installation

This release adds `db/migrations/002_profiles_and_page_size.sql`, which creates master-profile storage and the saved page-size preference. It preserves existing users, jobs, resumes, sessions, and opportunity IDs. **Run `npm run db:migrate` before starting the updated application.** Keep your existing `.env` and database; do not initialize a fresh database or recreate the manager account.

Back up PostgreSQL, stop your app service, pull the reviewed changes, run `npm ci`, `npm run db:migrate`, and `npm run build`, then restart your normal service after all commands succeed. Docker Compose applies migrations at app startup. See [the VPS update guide](GITHUB_VPS_SETUP.md) for the full workflow. The export-folder update alone required no migration; the profile and pagination update does.

## Accounts and permissions

New signups start pending. Manager approval enables sign-in; rejection/suspension blocks it. Status changes revoke all of that user's sessions immediately. Sessions expire after 12 hours.

Ordinary users can read and change their own applications only. The manager can view all users' current data, including notes and resumes, and manage account access. These terms appear on signup. Manager views have no job-edit controls, and the API also enforces ownership for mutations.

Deleting a user requires typing their email and permanently deletes the live database account and related application data in one PostgreSQL transaction. Previously exported files and existing backups are unaffected. Manager accounts are protected from web deletion/suspension.

Change your own password in Settings. Forgotten passwords are reset by the server operator:

```powershell
npm run account:reset-password
```

No email delivery or automatic recovery is configured in this release.

## VPS deployment

For the laptop → private GitHub repository → VPS clone/update workflow, use [GITHUB_VPS_SETUP.md](GITHUB_VPS_SETUP.md).

Use [WINDOWS_VPS_SETUP.md](WINDOWS_VPS_SETUP.md) for native Windows deployment and optional Docker Compose. You must supply your VPS, DNS hostname, and HTTPS configuration. A DuckDNS hostname can point to the VPS; this source does not register a domain or publish itself.

The existing ChatGPT-hosted prototype is a separate old deployment. Changing this source does not shut down that deployment. Retire it after validating the replacement.

## Checks

```powershell
npm test
npm run typecheck
npm run build
```

`npm test` covers URL normalization, company inference, application transitions, file signatures, password hashing, and safe export filenames/text.

Integration tests exercise the running app and a **real, dedicated PostgreSQL test database**. They insert and remove fixture accounts. Never point them at your actual application database:

```powershell
# Create job_support_test_local, migrate it, and run the app against it.
$env:DATABASE_URL = "postgresql://job_support:YOUR_PASSWORD@127.0.0.1:5432/job_support_test_local"
npm run db:migrate
$env:APP_ORIGIN = "http://localhost:3100"
npm run dev -- --port 3100
```

In another PowerShell terminal:

```powershell
$env:TEST_DATABASE_URL = "postgresql://job_support:YOUR_PASSWORD@127.0.0.1:5432/job_support_test_local"
$env:TEST_BASE_URL = "http://localhost:3100"
npm run test:api
```

The test database name must start with `job_support_test`. The app and test runner must use that same database. Clear the temporary environment variables or open a new terminal before returning to your real database.

Alternatively, after migrating a dedicated test database and building, set `TEST_DATABASE_URL` and run `npm run test:integration`. This launches the built server on loopback, runs the CLI/API checks, and stops the server. Set `UI_QA=true` to include browser checks using an already installed Microsoft Edge. Test runs clear authentication-throttle records in the dedicated test database.

## Project layout

- `app/`: application UI and authenticated API endpoints.
- `lib/auth.ts`, `lib/password.mjs`: database-backed sessions and scrypt passwords.
- `db/schema.ts`: Drizzle PostgreSQL schema.
- `db/migrations/`: reviewed SQL, applied transactionally by `npm run db:migrate`.
- `scripts/account.mjs`: server-side manager bootstrap/password reset.
- `app/export-button.tsx`, `lib/export.ts`: browser export and safe folder/text formatting.
- `compose.yaml`, `Dockerfile`, `Caddyfile`: optional Linux-container deployment.
- `deploy/`: native Windows startup and reverse-proxy example.

This is a fresh database version. No original prototype data is migrated.
