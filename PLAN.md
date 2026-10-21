# Jobbid implementation plan

## Agreed product

A private job application workspace. Users save job links, check duplicates within their account, keep job descriptions and tailored resumes, manually apply on the original website, and track progress. Default to a modern dark appearance with a persistent light/dark toggle.

## Delivery

1. Set up TypeScript and React using the Sites-supported Next-compatible Vinext framework. Use managed ChatGPT sign-in, D1/Drizzle for records, and R2 for private resumes. This replaces the initially proposed PostgreSQL/Prisma infrastructure to support a working hosted deployment without additional accounts or database credentials.
2. Build server-side owner checks, URL normalization and uniqueness, job validation, company identification, and authenticated document storage.
3. Build a responsive dashboard, searchable jobs list, status filters, job editor, details drawer, deadline view, and appearance settings.
4. Validate URL and status behavior, cross-user record/file isolation, document validation, TypeScript, and production compilation. Deploy privately if the hosting environment is available.

## Application behavior

- Apply opens the posting in a new tab; the user explicitly confirms submission afterward.
- Once applied, Apply is disabled even if the job progresses to an interview, offer, or rejection. View posting remains available. An explicit undo action clears the application date.
- Statuses: Saved, Preparing, Applied, Interview, Offer, Rejected, Withdrawn.
- Each job includes company, title, URL, location, work arrangement, salary, description, notes, deadline, application date, and one replaceable tailored resume.
- Normalize tracking parameters while retaining identifiers that distinguish postings. Enforce uniqueness per user in the database.
- Infer companies from known job board URL structures and company domains. Allow manual corrections. Do not fetch arbitrary user-supplied URLs from the server.
- Resume formats: PDF and DOCX, maximum 10 MB. File retrieval requires ownership checks. Replacing a file removes the prior attachment.
- Sign-up, sign-in, sign-out, and password recovery are provided by the managed identity provider, not separate app passwords.

## Deferred

Automatic application submission, AI resume scoring, browser extension, outbound email reminders, and shared job lists.
