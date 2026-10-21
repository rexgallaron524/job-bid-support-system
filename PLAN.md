# Version 2 — agreed scope and implementation

- Product title: All in one place-job support.
- Native Windows 11 VPS, independent from ChatGPT hosting/authentication.
- Fresh PostgreSQL database; no migration of the prototype's existing records.
- Preserve manual applications, duplicate checks, company suggestions, job descriptions/notes, tailored resume uploads, status/deadline tracking and dark/light appearance.
- Export button writes title and description through a browser-selected D:\jobbid root into {UTC saved date}-{company}-{short job ID}\jd.txt.
- Accounts require manager approval.
- Manager views all users' current process/data and manages accounts, with no mutations of others' individual jobs/resumes.
- Deleting a user deletes their live database account, sessions, jobs and resume bytes through PostgreSQL cascades. Local exports/backups remain.
- PostgreSQL stores application data, resumes, authentication sessions and account preferences.
- Ship setup/deployment documentation; actual VPS deployment requires the user's server and DNS details.
