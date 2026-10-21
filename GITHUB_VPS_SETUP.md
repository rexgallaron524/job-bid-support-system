# GitHub → VPS deployment workflow

The Git repository is the **jobbid** directory. It is already initialized on branch **main**. Run Git/npm commands inside that directory.

The configured `origin` is **https://github.com/rexgallaron524/job-bid-support-system.git**. The repository is private. Keep its access restricted to the intended users.

## First push from your laptop

1. This project's private GitHub repository is already selected. For a different destination, create an empty private repository and configure its URL before pushing.
2. Open a terminal:

   ```powershell
   cd "D:\workspace\job bid system\jobbid"
   npm run check:publish
   git status --short
   ```

3. Check that the changes include the new standalone app, PostgreSQL migrations, scripts and deployment files. Deleted old hosting files should also be included in the commit.
4. Stage and review the changes before committing:

   ```powershell
   git add -A
   git diff --cached --stat
   git diff --cached --name-only
   git commit -m "Prepare standalone PostgreSQL version for VPS hosting"
   ```

5. After committing, push to the configured remote:

   ```powershell
   git push -u origin main
   ```

   Inspect `git remote -v` if you need to confirm the destination before pushing. Authenticate through your Git credential manager or SSH setup. Do not put passwords/tokens in a remote URL or commit them.

## First clone on the VPS

Install Git and configure access to the private repository. A read-only SSH deploy key is an option for a server that only needs to clone/pull. Add only the public key to the repository; keep its private key on the VPS.

From the parent folder where you want to install the app:

```text
git clone https://github.com/rexgallaron524/job-bid-support-system.git job-support
cd job-support
```

Or use the SSH clone URL after configuring a deploy key.

The clone contains `package.json`, `app/`, `db/` and the other app files directly at its root. There is no additional nested jobbid directory inside this clone.

Install Node.js and PostgreSQL for native hosting, then create your VPS database/user. Create a fresh `.env` from `.env.example` on the server and enter the **VPS** database credentials and HTTPS origin.

On Windows:

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env and create the PostgreSQL role/database before continuing.
npm run db:migrate
npm run manager:create
npm run build
npm start
```

On Linux, copying the environment template uses `cp .env.example .env`. The npm commands are the same for native Node hosting; service and reverse-proxy configuration depend on the server OS. The repository also includes an optional Docker Compose deployment.

For Windows startup, Caddy, DNS and HTTPS details, follow [WINDOWS_VPS_SETUP.md](WINDOWS_VPS_SETUP.md). For either OS, keep the Node server behind the reverse proxy and configure a service supervisor so it restarts after a reboot.

## Updates after the first deployment

On the laptop, review/test your change and publish a new commit:

```text
git add -A
git commit -m "Describe your change"
git push
```

On the VPS, back up PostgreSQL first, stop the application service, and then run:

```text
git pull --ff-only
npm ci
npm run db:migrate
npm run build
```

Continue only when each command succeeds, then restart the application service. Plan a short maintenance window for this initial deployment model. Do not rerun `manager:create` on every update. This workflow does not automatically deploy on a GitHub push.

The profile/pagination update includes **002_profiles_and_page_size.sql**. It adds master profiles and a page-size preference without replacing existing records or opportunity IDs. Run the migration before restarting the updated application; keep the existing `.env`, database, and manager account. Do not modify an already applied migration. Docker Compose's app startup runs the migration command automatically.

The progress dashboard adds **003_activity_dashboard.sql**. It creates activity storage and recovers existing saved/application dates without guessing historical interviews or outcome dates. The same migration command applies this file after any earlier pending migrations. Back up PostgreSQL before updating; no database reset or manager recreation is needed.

## What Git contains

- Application code and configuration.
- package.json and package-lock.json.
- Reviewed SQL migrations.
- Tests and deployment instructions.
- .env.example with placeholders.

## What stays outside Git

- .env and real database credentials.
- Database records, uploaded resumes, local TXT exports and database backups.
- node_modules, .next, old hosting artifacts, local tools and generated QA output.
- SSH private keys and authentication tokens.

Cloning/pulling source code does not transfer PostgreSQL data. Each environment has its own database and .env. Keep server-only configuration out of source commits.

`npm run check:publish` checks the current working files against common generated-file and credential patterns. It also catches already tracked files that should be ignored. It does not stage/commit/push anything or replace a manual review of the staged diff.

The docs in the outer workspace folder are outside this Git repository. The clone includes the setup guides, [feature guide](docs/FUNCTIONALITIES.md), and [verification report](docs/VERIFICATION.md).

## Official references

- [Add an existing project to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Clone a GitHub repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- [Manage repository deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)

