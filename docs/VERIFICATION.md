# Standalone version 2 — implementation and verification

Date: 2026-10-21.

The new **All in one place-job support** application is implemented in [this repository](../). It runs on standard Node.js/Next.js with independent email/password authentication and PostgreSQL. No new VPS site/domain has been deployed.

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
