# Standalone version 2 — implementation and verification

Date: 2026-10-21.

## Progress dashboard and completed interviews — 2026-10-21

Added an owner-scoped progress dashboard with UTC daily/weekly/monthly grouping, date presets and inclusive custom ranges, company/activity/work-arrangement filters, six milestone totals, a chart, exact period values, and a paginated activity feed. Completed interview rounds are recorded manually by date and can be removed to correct mistakes. Retried submissions are idempotent. Saved/application/outcome milestones are recorded transactionally; repeated status changes cannot duplicate them. Undoing Applied removes its application milestone, and job/account deletion cascades to activity. Managers have read-only reports and interview views.

Validation passed: **20 unit tests**, production build and TypeScript checking, **127 API checks against isolated PostgreSQL**, CLI account checks, and Edge browser checks. Coverage includes inclusive date boundaries, Monday-start weeks and month grouping, filtering, totals across multiple feed pages, owner/manager access, interview retries/removal, milestone deduplication, application undo, and cascade deletion. Browser checks exercised multiple interview rounds, correction removal, date/group/filter controls, matching metric counts, existing profile/export/pagination flows, desktop/mobile layouts, and runtime errors. Dashboard screenshots were inspected.

Migration **003_activity_dashboard.sql** passed initial and repeated runs. A pre-existing Interview-status job retained its data and recovered only the exact known saved/application dates; no completed interview was inferred. Earlier interview/outcome dates are not guessed. Verification was local; publishing the commit does not deploy the production VPS. Back up PostgreSQL and run `npm run db:migrate` before starting the updated app. Previously applied migration files were left unchanged.

## Master profile, pagination, and opportunity IDs — 2026-10-21

Implemented a detailed, manually editable master profile with PostgreSQL storage and TXT download; account-saved 10/20/50 application pagination; visible/searchable/copyable opportunity IDs; and matching IDs in both exported folder names and jd.txt. Managers can read saved profiles, and account deletion cascades to profile data. Revision checks prevent stale tabs from overwriting a newer saved profile. Existing opportunity IDs and export folder names are preserved.

Checks passed: **17 unit tests**, production build/TypeScript checks, **84 API checks against isolated PostgreSQL**, manager/password CLI checks, and Edge browser checks. Browser coverage includes profile save/reload/download, unsaved-navigation protection, 10/20/50 row sizes with 53 opportunities and an incomplete final page, ID search and export matching, page-size restoration after reload, owner isolation, read-only manager views, export-folder permissions/persistence, themes, mobile widths, and runtime errors. Desktop/mobile screenshots were inspected.

Migration **002_profiles_and_page_size.sql** was applied and rerun successfully in the test database. An existing test user and opportunity survived unchanged, including their short ID; the new page-size preference defaulted to 10. The original migration was not edited. Verification was local; production deployment is a separate step after publishing the commit. Back up the production database and apply the migration before starting the updated app; keep existing data and configuration.

## Export folder update — 2026-10-21

The export button now remembers the selected local root in browser IndexedDB, separately for each account, and restores it after a page refresh. It checks write permission before reuse, supports changing the root, and reports storage failures without preventing an export. This update requires no PostgreSQL migration or environment changes and has not been deployed to the production VPS.

Validation for this update: all 13 unit tests, TypeScript checking, the production build, and the publish-file check passed. Edge browser checks passed for real text-file writes, folder restoration after reload without reopening the picker, permission denial and renewal, cancelled folder changes, new destinations, browser storage failure recovery, unsupported API handling, and separate account preferences. Existing login, job save, themes, manager views, and mobile layout checks also passed. Browser checks used an isolated test database and injected directory selection with real browser filesystem handles; the native Windows picker and the actual D:\jobbid location still need an interactive check on the user's computer.

The **All in one place-job support** application is implemented in [this repository](../). It runs on standard Node.js/Next.js with independent email/password authentication and PostgreSQL. The initial implementation report below records local verification and setup work. The user subsequently deployed the application to a separate production VPS; local verification and GitHub pushes do not deploy updates there.

## Implemented

- Fresh PostgreSQL schema with users, sessions, jobs, resume byte storage and authentication throttles.
- Approval-based signup, independent sign-in/out, password change, and operator password reset.
- Server-side manager bootstrap with hidden password prompts; no public manager enrollment.
- Manager dashboard with configurable path, read-only views of all users' application data, and approve/reject/suspend/delete account actions.
- Ownership enforced for all job/resume mutations; manager account deletion/suspension is protected in the web API.
- Confirmed user deletion cascades through sessions, jobs and resume bytes.
- Manual application workflow preserved, with URL duplicates/company suggestions, descriptions, resumes, status/dates, deadlines and browsing.
- Local export to a browser-selected D:\jobbid root, with dated company/short-ID folders and UTF-8 jd.txt.
- Product rename and dark/light appearance, with signed-in theme preferences in PostgreSQL.
- Native Windows startup, optional Docker Compose/Caddy configuration, setup guides and updated functionality documentation.
- Removed the old Sites deployment manifest, managed ChatGPT authentication, D1/R2 code and Vinext/Workers build integration.

## Checks completed

- Production build and TypeScript check passed on Windows with Next.js 16.4.2 and Node.js 22.23.3.
- 13 domain/password/export tests passed.
- Initial migration and repeated no-op migration passed against **real PostgreSQL 18.6** in an isolated test database.
- 58 API checks passed against the built standalone server and PostgreSQL: signup approval, role/ownership isolation, manager page access, resume upload/download and binary storage, status transitions, CSRF checks, throttling, session revocation, account deletion and database cascades.
- Manager bootstrap and password-reset CLI checks passed, including hidden password input and session revocation.
- Microsoft Edge browser checks passed: signup privacy notice, own-account login, job save/company suggestion, title/description export, theme switching, manager view, desktop/mobile widths, and no runtime page errors.
- Environment doctor passed against the test PostgreSQL instance.
- Production dependency audit: **0 reported vulnerabilities** after upgrading the inherited framework and compatible dependencies.
- Full development dependency audit still reports advisories in the lint/schema-generation dependency trees. No forced downgrade of the framework's lint tools was applied.

Browser screenshots were generated under `outputs/qa/` during local checks. These build artifacts are ignored by Git and are not included in a fresh clone.

The browser export check used real browser File System handles in isolated origin storage with an injected directory picker. Filename/content tests and actual browser writes passed. The native Windows directory chooser and writing to your specific D:\jobbid folder still require an interactive check on your computer.

## Operational work remaining

- Supply/configure the actual VPS and hostname/DNS.
- Configure its PostgreSQL credentials, create your real manager account, and establish backups.
- Install/configure Caddy HTTPS and persistent Windows services/tasks.
- Test the domain, OS folder picker, service reboot behavior and backup restoration on that server.
- Docker configuration is included but was not executed here; Docker was not available.
- Retire the original private hosted prototype once the replacement is working.

Use [Windows VPS setup](../WINDOWS_VPS_SETUP.md) and [local setup/testing](../README.md).

No real manager credentials or application records are seeded. Tests used separate fixture accounts and a dedicated job_support_test database.

## Original prototype hosting

The previously deployed private prototype at [its original address](https://jobbid-private-workspace.danielkocurek95.chatgpt.site) is a separate existing deployment. It was not redeployed, removed, or pointed at the new database during this implementation.

Original source commit: f5c659aa77ec7a234370c70a6960a9c4ae2b8b04. Keeping that historical reference does not mean the revised application is hosted there.
