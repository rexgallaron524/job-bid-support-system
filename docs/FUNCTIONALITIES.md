# All in one place-job support — Version 2 functionality

This describes the standalone PostgreSQL version in [jobbid/](../). It replaces the prototype's ChatGPT sign-in and D1/R2 storage. Fresh installations start empty; upgrades apply incremental migrations to preserve existing production records.

## 1. Accounts, privacy, and approvals

Sign in using your own email and password. New users request an account with a display name, email, password (12–128 characters), and acknowledgement that the manager can view their application data.

New accounts are **pending**. The manager approves or rejects them. Pending, rejected, and suspended users cannot access a workspace. There is no automatic email verification or email notification in this release; applicants should use an address they control.

Ordinary users can access only their own master profile, jobs, and resumes. Duplicate checks are also per user. The manager can read all users' profiles, application records, descriptions, notes, and resume files. This visibility is disclosed on signup, in Settings, and on the profile page.

Passwords are salted and hashed with scrypt. A random session token is stored in an HttpOnly, SameSite cookie; the database stores its SHA-256 digest. Production cookies require HTTPS. Sessions expire after 12 hours. Password changes, password resets, and manager account-status changes revoke affected sessions. Login/signup attempts have persistent database-backed rate limits.

Settings includes password change. A forgotten password requires the server operator's `npm run account:reset-password` command. No ChatGPT account, ChatGPT identity, OpenAI API key, or automatic Codex integration is required.

## 2. Main workflow

1. Find a job yourself.
2. Save its URL, company, title, and optional details.
3. Paste the description and export it if you want to prepare a resume locally.
4. Upload the PDF/DOCX resume suited to the job.
5. Click **Apply** to open the original posting in another tab.
6. Submit the application manually on that website.
7. Return and choose **Mark as applied**.
8. Update the status as the application progresses.

Opening a posting does not mark the job as applied and does not submit any information. Applied jobs have a disabled Apply control and still offer **View posting**.

## 3. Saving and editing jobs

Required: full HTTP/HTTPS job URL, company name, and job title.

Optional: location, work arrangement, salary text, deadline, job description, personal notes, and a tailored resume.

| Field | Limit / choices |
| --- | --- |
| URL | 4,000 characters; public-style HTTP/HTTPS URL without embedded credentials |
| Company | 200 characters |
| Job title | 250 characters |
| Location | 250 characters |
| Salary text | 150 characters |
| Description | 60,000 characters |
| Notes | 30,000 characters |
| Work arrangement | Unspecified, Remote, Hybrid, On-site |
| Deadline | Valid calendar date |

A complete JSON request also has a 200 KB size limit. Editing details preserves the job's application state/date. Jobs have a UUID internally and a stable, eight-character short ID for display and exports.

The **Opportunity ID** appears in application rows, details, deadlines, resume cards, and manager views. It can be copied from job details and searched in the application list. PostgreSQL enforces global uniqueness. The ID cannot be changed through job editing; the exact same ID appears in the export folder name and inside `jd.txt`. Existing opportunities keep their IDs.

You can delete your own job after confirmation. Its attached resume is deleted from PostgreSQL in the same cascading database operation.

## 4. Duplicate URL detection

The app compares normalized URLs and rejects duplicates in your own workspace. The database enforces uniqueness using the owner and a SHA-256 digest of the canonical URL, including for long URLs.

Normalization ignores common tracking parameters (`utm_*`, `gclid`, `fbclid`, and similar), normalizes hostnames, removes `www`, ignores ordinary fragments/trailing slashes, and sorts query parameters. Job identifiers and hash-based application routes are retained.

The same URL may exist in separate users' workspaces. Different job-board URLs describing the same role are not detected as semantic duplicates. The app does not follow short links or scrape postings.

## 5. Company identification

When adding a new job, leaving the URL field can suggest a company from recognized posting URL patterns such as Lever, Greenhouse, Ashby, Workable, SmartRecruiters, and Workday.

Other company career domains use a domain-name heuristic. General job boards may leave the suggestion blank. Suggestions remain editable. Once you manually edit the company, the UI respects your input.

This is URL-based inference, not a verified company lookup. Logos are generated initials.

## 6. Application statuses and dates

Available statuses: **Saved, Preparing, Applied, Interview, Offer, Rejected, Withdrawn**.

New jobs start Saved. Applied, Interview, or Offer sets an application timestamp if one does not already exist. Subsequent status changes preserve it. Rejected/Withdrawn alone does not create an application date.

You cannot move a job with an application date back to Saved/Preparing until you explicitly choose **Undo applied**. Undo clears the application date and returns the job to Saved while retaining its description, notes, and resume.

Status changes use PostgreSQL row locks so simultaneous requests base their decisions on the latest job state. This version stores current status and saved/applied/updated dates; it does not keep a full event-by-event application history or allow editing historical applied dates.

## 7. Tailored resumes

Each job can have one current PDF or DOCX attachment up to **10 MiB (10,485,760 bytes)**. The app checks extension and basic document signatures; it does not run antivirus scanning or analyze resume content.

Upload, replace, download, or remove the attachment from job details. Uploading a new version overwrites the current saved copy, including for an applied job. There is no attachment version history or immutable submitted-resume snapshot.

Resume bytes live in PostgreSQL `bytea`, with associated filename/type/size metadata. Attachment writes and metadata changes are transactional. Owners and managers have separate authenticated download endpoints. Other ordinary users cannot download them.

The My resumes page lists jobs with documents and offers downloads and job links. If a job save succeeds but a subsequent upload fails, the UI retains the saved job and allows retrying.

## 8. Local TXT export

In a job's details, click **Export JD to folder** and choose **D:\jobbid** in the browser folder picker on your first export. The app remembers this root for your account in this browser, so subsequent exports reuse it even after a page refresh.

Example:

```text
D:\jobbid\2026-10-21-Acme-a1b2c3d4\jd.txt
```

The subfolder uses the job's UTC saved date, sanitized company name, and stable short ID. Invalid Windows filename characters are replaced. The resulting UTF-8 text contains:

```text
Opportunity ID: a1b2c3d4

Job title: Platform Engineer

Job description:
The saved description...
```

Text uses Windows-style line endings. Re-exporting the same job/company replaces its `jd.txt`. Changing the company produces a different folder name; old local files are not cleaned up automatically.

Export requires Edge/Chrome and HTTPS or localhost. The browser asks you to select a directory initially and may ask you to renew write permission later. It cannot silently write to an arbitrary drive or confirm the absolute drive path. The selected directory belongs to the computer running the browser, even when the server is a remote VPS. Select D:\jobbid itself, rather than one of its existing job subfolders.

Use **Change export folder** to choose a different root. Cancelling keeps the previous selection. Changing the root does not move existing exports. The folder handle is stored in browser IndexedDB, separately for each account; it is not a PostgreSQL record and does not sync across devices or browsers. Clearing site data or changing the website origin requires choosing the folder again. If the browser cannot store the handle, the app reports that the selection may need to be repeated.

These are ordinary folders, not Git repositories or submodules. Exports are local copies for your own Codex workflow. The application does not launch Codex, generate resumes, or upload exported descriptions to an AI provider.

## 9. Dashboard, browsing, and search

Overview shows:
- Total opportunities.
- Applications sent: jobs with an application date, including later stages.
- In conversation: jobs currently in Interview.
- Saved for later: Saved + Preparing jobs.

Clicking a statistic opens its corresponding set of records, including the combined sent/saved groups. This corrects the prototype's mismatch between some totals and their filters.

Browse all applications; filter by status or work arrangement; search by opportunity ID, title, company, location, or notes. Search does not inspect the description, original URL, salary, or resume contents.

Sort newest first, company A–Z, or deadline first. Overview pages contain five jobs. **All applications** offers **10, 20, or 50 rows per page**, previous/next controls, page count, and a visible record range. The selection is saved to the signed-in account in PostgreSQL and restored after refresh/sign-in. Changing the page size or filters returns to page one; an incomplete final page is handled automatically. The app fetches the signed-in user's list and filters/pages it in the browser. It does not provide live synchronization between open tabs.

The journey chart summarizes current statuses. Help explains the manual workflow.

## 10. Deadlines

Add a valid deadline to a job to include it in deadline views while it is unapplied and not Offer/Rejected/Withdrawn.

The overview shows the nearest three deadlines; the deadline page shows all eligible jobs. The navigation/bell count includes deadlines within seven days and overdue entries. Dates use UTC, and the open page refreshes its current-date calculation periodically.

These are in-app reminders. There is no email/push delivery, calendar integration, interview scheduling, or automatic posting-expiry detection.

## 11. Appearance and accessibility

Dark mode is the default. Toggle dark/light from the header or Settings. Signed-in preferences are stored in PostgreSQL and restored at login; browser local storage helps set an initial appearance before the page loads. Signed-out appearance uses that local browser preference.

The interface adapts to desktop and mobile widths, with a mobile navigation drawer. Dialogs include keyboard focus management and Escape handling; inputs and primary actions have labels, and reduced-motion preference is respected.

The application/browser title is **All in one place-job support**.

## 12. Manager dashboard

The manager is bootstrapped from a server-side command, not from public signup. Your own email/password is entered during setup; no default manager password is shipped.

The dashboard lives at `/{MANAGER_PATH}` (default `/manager`). A different path can be configured, but authentication, role checks, and HTTPS are what secure it.

Managers can:
- See account names/emails, roles, approval states, and job counts.
- Search users and refresh the account list.
- Approve, reject, suspend, or reapprove ordinary users.
- Open any user's current application list.
- Read title, company, URL, status, dates, description, notes, work details, salary, and resume metadata.
- Download the user's current resume.
- Read the user's saved master profile through a read-only section.
- View the user's progress dashboard and completed interview records without editing them.
- Delete an ordinary account after typing its exact email.

Managers cannot:
- Edit another user's job fields or application status.
- Edit another user's master profile.
- Delete another user's individual job or attachment.
- Promote an ordinary user to manager through the web API.
- Delete/suspend manager accounts through the dashboard.

A manager still has their own ordinary workspace and can edit their own applications there.

## 13. Deleting users

Confirmed account deletion is a PostgreSQL transaction with foreign-key cascades:

```text
User
├── Sessions
├── Master profile
└── Jobs
    ├── Resume bytes
    └── Activity milestones and completed interview rounds
```

Jobs include the descriptions, notes, status and dates, so those disappear with the jobs. Active cookies no longer grant access. If any database operation fails, the transaction rolls back.

Local TXT exports and previously created database backups are outside the live cascade and remain until separately removed or expired. Persistent hashed rate-limit entries are temporary security records; they are not application-process records.

## 14. Data storage and hosting

| Data | Location |
| --- | --- |
| Accounts, password hashes, roles, approval state | PostgreSQL |
| Session token digests and expiry | PostgreSQL |
| Jobs, descriptions, notes, status, dates | PostgreSQL |
| Activity milestones and completed interview records | PostgreSQL |
| Resume binary contents and metadata | PostgreSQL |
| Master career profile and revision | PostgreSQL |
| Application page-size preference | PostgreSQL |
| Signed-in appearance preference | PostgreSQL; browser cache for initial render |
| Temporary hashed authentication rate limits | PostgreSQL |
| Authentication cookie | Browser; HttpOnly, Secure in production |
| Exported jd.txt files | User-selected local Windows folder |
| Downloaded profile.txt | Browser's usual download location |

The application runs as a standard Node.js/Next.js server. Native Windows deployment and optional Docker Compose configuration are included, with Caddy for HTTPS. No domain registration or VPS publication happens automatically.

The new source has no ChatGPT login, Cloudflare D1/R2 binding, or Sites deployment manifest. The original private hosted prototype is a separate old deployment and has not been removed by changing local source.

## 15. Current boundaries and setup

No automatic job applications, AI generation, cross-board semantic deduplication, bulk import, full status-history audit, resume versioning, email delivery, MFA, or automatic account recovery is included. The progress dashboard records selected milestones and completed interviews; it is not a complete audit of every edit or status transition.

For setup/testing, see [jobbid/README.md](../README.md). For Windows hosting, HTTPS, database backup and service setup, see [WINDOWS_VPS_SETUP.md](../WINDOWS_VPS_SETUP.md). See [DEPLOYMENT.md](VERIFICATION.md) for the checks actually completed and deployment limits.

## 16. My profile — master source for tailored resumes

The **My profile** navigation page contains your full career record. Enter or copy your LinkedIn information manually; no LinkedIn connection, scraping, or automatic import is performed.

Sections include full name, professional headline, location, resume contact email, phone, LinkedIn URL, portfolio/website, professional summary, work experience, education, skills, projects, certifications/courses, languages, awards/publications/achievements, volunteering/organizations, career preferences, and additional career information. Career sections support detailed text, multiple entries, dates, links, and achievements. Section links help navigate the page, and the filled-section count helps you see what you have entered.

Use **Save profile** to store the complete profile in PostgreSQL. Contact details here do not change the account's sign-in email. Changes are explicit saves; the app warns before leaving with unsaved edits. Revision checks reject stale concurrent saves instead of overwriting a newer profile from another tab. A failed save leaves your draft on screen so you can copy or retry it.

Saved profiles can be downloaded as UTF-8 **profile.txt** with Windows-style line endings. Save pending edits before downloading. The download includes every populated section, so review it before sharing. It uses the browser's standard download destination; the job-description export uses your remembered local root folder.

To prepare a tailored resume: save/download the master profile, export the target opportunity's `jd.txt`, use both as source material in your local Codex workflow, and attach the finished PDF/DOCX to the opportunity. Automatic resume generation is not included.

Ordinary users can read and update only their own profile. The manager can read profiles but cannot modify another user's profile through the manager API or dashboard. Deleting an account cascades to its profile as well as its application records. Local profile downloads and database backups remain outside that cascade.

Upgrading an existing installation requires **002_profiles_and_page_size.sql**, applied with `npm run db:migrate` before restarting the updated app. This migration preserves existing records and IDs; it does not reset the production database.

## 17. Progress dashboard and completed interviews

Open **Progress dashboard** to view activity by date. Its six totals show jobs saved, applications submitted, interview rounds completed, offers recorded, rejections recorded, and withdrawals recorded. The chart supports **daily, weekly, or monthly** buckets and an expandable table of exact values, including zero-activity periods. The activity feed shows opportunity IDs and links back to the corresponding job, with 20 records per page; summary totals cover the entire selected range rather than only the current page.

Date presets are Today, This week, This month, Last 7 days, Last 30 days, and Custom dates. Custom ranges support up to five years. From/through dates are inclusive, use UTC, and weeks start Monday. Weekly/monthly buckets may start before the chosen range, but include only events within that range. Filter by company, activity type, or work arrangement; every filter applies to the totals, chart, and activity feed. Company/work-arrangement filtering uses the opportunity's current details.

Applications, interview rounds, and offers have prominent summary cards; saved/rejected/withdrawn totals appear in a secondary row. The default chart uses separate application and interview bars, with an optional **All activity** comparison. It opens on the latest period. The selected period's exact counts remain visible below the chart; select another period, use the previous/next buttons, or tap/click the chart. For longer ranges and narrow screens, a labeled window keeps bars and labels readable; the period selector and paginated exact-values table retain every period, including zeros. The exact table has 10/20/50-row options and localized horizontal scrolling, without a fixed-height nested vertical scroller.

Company, activity-type, and work-arrangement controls are under **More filters**. Active-filter buttons remove individual filters; **Clear filters** resets those three filters while preserving the date range and grouping. Custom dates expose From/Through inputs only when requested.

New opportunities record their saved date transactionally. The first recorded application creates an application event using the job's application timestamp. Offer, Rejected, and Withdrawn milestones record the first transition to each of those statuses after this feature is installed. Repeating or revisiting a status does not create another milestone of the same kind for that opportunity. These historical milestones remain counted when the current status later changes. Undoing Applied removes its application event; applying again records a new application date. Interview records are independent of application status.

In opportunity details, choose **Log completed interview**. Enter the round name, actual completion date, and optional notes. Each round is a separate event, even for the same opportunity or date. Future completion dates are rejected. Retrying the same submission does not create duplicate records. Incorrect completed-interview records can be removed after confirmation, which updates the dashboard counts; this does not edit the opportunity's status or remove automatic milestones. Moving a job to Interview status alone never counts as a completed interview.

Migration **003_activity_dashboard.sql** recovers existing saved and application dates from their stored timestamps. It does not invent old interview or outcome dates from the current status or last edit date. You may manually log earlier completed interview rounds using their actual dates. Existing users, profiles, resumes, jobs, and IDs are preserved. Apply the migration before starting the updated app.

Ordinary users can query and edit only their own interview records and view only their own activity report. Managers can inspect another user's report/interviews through read-only endpoints and dashboard controls. Deleting a job cascades to its milestones and interviews; deleting an account cascades through all of its jobs and their activity. Dashboard totals therefore describe retained records, rather than an archive of deleted processes.

## 18. Readability and navigation

Shared styles use 16px body/form/table text, at least 14px supporting text, and 28–32px page headings at the default browser text size. Text respects browser text enlargement; chart labels are measured at the actual container width. Both themes have stronger foreground contrast and visible keyboard focus. Primary controls have at least 44px targets.

The mobile navigation has a close button, Escape handling, focus containment, and focus restoration. Closed navigation is excluded from keyboard focus. Wide job and activity tables remain horizontally scrollable inside their own regions; essential columns are retained.

Opportunity details link to overview, JD export, resume, interviews, description, and notes. The existing JD export appears before the resume attachment section. My profile includes a saved/unsaved indicator near the top, section links, and return links from career sections. Its save bar is sticky on larger screens while edits are pending and stays in normal document flow on small screens.

This presentation update changes no schema, ownership rules, application milestones, export filenames, or manual-application workflow. Board view, follow-up tasks, saved views, archiving, and conversion funnels are not included.
