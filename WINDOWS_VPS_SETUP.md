# Deploy on your Windows 11 VPS

This guide runs the new app on your own server. It does not create hosting accounts, change DNS, or shut down the old ChatGPT Sites prototype.

## Native Windows deployment (recommended starting path)

1. Install Node.js 22.13+, PostgreSQL 18, and Caddy for Windows. Keep Windows and these components updated.
2. Copy the `jobbid` directory to the VPS (for example `D:\apps\job-support`). Do not copy `node_modules`, `.next`, old build output, or development database files.
3. Create the dedicated PostgreSQL role/database as described in [README.md](README.md). Bind PostgreSQL to loopback; do not expose port 5432 publicly.
4. Choose a DuckDNS or custom hostname and point its DNS record at the VPS public IP. Configure the network/firewall/NAT to reach this server on TCP **80 and 443**. Do not expose the app's 3000 port or PostgreSQL port.
5. In the app directory:

   ```powershell
   npm ci
   Copy-Item .env.example .env
   ```

6. Edit `.env`:

   ```dotenv
   DATABASE_URL=postgresql://job_support:YOUR_ENCODED_PASSWORD@127.0.0.1:5432/job_support
   APP_ORIGIN=https://your-name.duckdns.org
   MANAGER_PATH=choose-your-own-manager-path
   TRUST_PROXY=true
   ```

   `TRUST_PROXY=true` assumes the app listens only on loopback behind Caddy, which overwrites client forwarding headers. The manager path is optional obscurity; password/session and role checks enforce access.

7. Initialize and build:

   ```powershell
   npm run db:migrate
   npm run manager:create
   npm run build
   ```

8. Copy `deploy\windows.Caddyfile` to your Caddy configuration folder and replace its example hostname. Caddy automatically requests/renews HTTPS certificates when DNS and inbound ports are correct. Run it as a Windows service using the installation method supported by your Caddy package.
9. To test the app process:

   ```powershell
   powershell.exe -NoProfile -File .\deploy\start-windows.ps1
   ```

   This runs migrations first, then the production app on `127.0.0.1:3000`. It is a foreground process for initial verification. Do not use `npm run dev` for the deployed service.

10. Configure Windows Task Scheduler or your existing Windows service supervisor to run that startup script at boot under a dedicated account with access to the project and its `.env`. Use a hidden/noninteractive task, an absolute script path, a working directory of the project, and restart on failure. Ensure Node is in that account's PATH. PostgreSQL and Caddy must also start at boot. Test a reboot before relying on the service.

Production cookies require HTTPS. Visit the actual hostname through Caddy when testing login. Keep `APP_ORIGIN` identical to the browser's origin with no trailing slash.

## Optional Docker Compose

Use this path only if your Windows VPS supports **Linux containers** through Docker/WSL2 and your VPS provider permits the required virtualization. Native Windows deployment above does not require Docker.

Copy `.env.example` to `.env` and set:
- `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`.
- `DATABASE_URL=postgresql://job_support:ENCODED_PASSWORD@db:5432/job_support` (use hostname **db**, not localhost).
- `SITE_DOMAIN=your-name.duckdns.org`.
- `MANAGER_PATH` if desired.

```powershell
docker compose up -d --build
docker compose exec app node scripts/account.mjs create-manager
docker compose logs --tail 100 app
```

The app waits for PostgreSQL health, migrates its schema on startup, and uses Caddy for HTTPS. Only Caddy publishes host ports. PostgreSQL 18 data persists in the `postgres_data` volume at its version-appropriate `/var/lib/postgresql` parent path. Never run `docker compose down -v` on a system whose data you need.

## Database backups and deletion

Everything needed to restore application accounts/jobs/resumes is in PostgreSQL. Back up with `pg_dump`, store backups privately away from the live database disk, and test restoration to a separate database. In Windows PowerShell use the tool's output-file option (do not pipe a binary custom-format dump through text redirection):

```powershell
pg_dump -h 127.0.0.1 -U job_support -d job_support -F c -f D:\backups\job-support.dump
```

Create/protect the backup folder first. Set a suitable retention schedule for your VPS. Database account deletion removes live records; old backups may still contain deleted users until those backups expire. Browser-exported `jd.txt` files are separate local copies.

## Verify the deployment

- Sign in as your manager and confirm the manager URL opens.
- Request a separate account; confirm it cannot sign in before approval.
- Approve it; save a job, description and PDF/DOCX resume.
- Confirm another user cannot see/change that job.
- View it as manager; confirm it is read-only and its resume downloads.
- Test export from Edge/Chrome on your local Windows PC by selecting `D:\jobbid`.
- Check dark/light appearance and mark/undo an application.
- Delete the test user by entering their email; confirm their records disappear.
- Check HTTPS, backup restoration, and service startup after a reboot.

## Retire the old hosted prototype

The old private Sites deployment is separate from this repository's new Node app. No current code calls its identity or database. After the VPS version works, remove/unpublish the prototype through its original hosting controls. This task has not performed that external removal or migrated its old records.

## References

- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [PostgreSQL Windows downloads](https://www.postgresql.org/download/windows/)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [DuckDNS](https://www.duckdns.org/about.jsp)
- [Browser directory picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)

