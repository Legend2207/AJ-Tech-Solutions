# AJ Tech Solutions Client Portal

A client portal for creating an account, submitting technology service requests, viewing account-specific requests, invoices, documents, and notifications, and chatting with staff.

## Run locally

1. Install Node.js 20.17 or later.
2. From this directory, install dependencies and create a session secret:

   ```powershell
   npm ci
   $env:SESSION_SECRET = (node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
   ```

3. Bootstrap the first Super Admin from a private terminal prompt:

   ```powershell
   npm run setup-admin -- --role superadmin
   ```

   The command asks for the account details and hides password input. It refuses to create another Super Admin if one already exists. After bootstrap, only an authenticated Super Admin can create Admin or additional Super Admin accounts. Applicants can request Admin access from the registration form; the request stays pending until an active Super Admin approves it. Approval issues a one-time temporary password that must be changed at first sign-in.
4. Start the application and open `http://localhost:3000`:

   ```powershell
   npm start
   ```

   Sign in or create a client account.

Clients can message admins, admins can message clients and super admins, and super admins can message admins. Conversations are private to the two participants. The Admin workspace includes database-backed overview statistics, client account management, service catalog management, request status/progress/assignment and notes, in-app notifications and announcements, PDF/XLSX exports, admin profile and preferences, login history, and activity logs.

The Super Admin workspace includes global user and request statistics, user and Admin account management, Admin access-request review, Admin module permissions, service and request management, published website content, system settings and status, audit search, platform notifications, report exports, database backup/download/restore, and profile/security preferences. Super Admins can use Admin service and request workflows; Admin accounts cannot access Super Admin APIs. Admin module permissions are enforced server-side and restricted pages are hidden in the Admin interface. Only the first Super Admin can be bootstrapped from the local setup command; creating additional privileged accounts requires an existing Super Admin session. Existing databases are migrated automatically.

Service images and profile pictures accept PNG, JPEG, or WebP uploads up to 5 MB. Notifications are in-app only; email delivery requires a mail provider integration. Service request `documents` are currently stored and displayed as client-provided references, not uploaded files. Database backup and restore operate on the server's SQLite database; keep generated backups protected and configure appropriate off-site backup storage for production.

The local database is stored in `auth.db` by default. To use a different location, set `DB_PATH` before starting the server. Keep database files and backups private.

## Production and Docker

Production mode requires a unique `SESSION_SECRET`. Generate one with a trusted random generator and keep it outside source control. The application uses secure, HTTP-only session cookies in production; deploy it behind HTTPS.

For Docker Compose, create a private `.env` file before starting. Generate a unique session secret with `openssl rand -hex 32` and set `TRUST_PROXY=0` for local use, or `TRUST_PROXY=1` behind a trusted reverse proxy.

```text
SESSION_SECRET=replace-with-a-long-random-secret
TRUST_PROXY=0
```

The Compose app port binds to `127.0.0.1`, so it is not exposed directly to the internet. For a public VM deployment, run a trusted HTTPS reverse proxy on the host. Point a DNS A record for your domain to the VM's public IP, install Caddy on Ubuntu, and configure `/etc/caddy/Caddyfile`:

```text
portal.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Set `TRUST_PROXY=1` in `.env` when using this trusted local reverse proxy. Allow inbound TCP ports 80 and 443 in both the cloud network security rules and the VM firewall. Keep SSH access restricted to your own IP address where possible. Caddy obtains and renews HTTPS certificates automatically when DNS points to the VM and ports 80 and 443 are reachable.

On an Ubuntu VM with Docker Compose installed, clone the repository and run:

```bash
cd AJ-Tech-Solutions
umask 077
printf 'SESSION_SECRET=%s\nTRUST_PROXY=1\n' "$(openssl rand -hex 32)" > .env
docker compose build
docker compose run --rm web npm run setup-admin -- --role superadmin
docker compose up -d
docker compose ps
```

Use the Super Admin setup prompt only over a private SSH session. The named `aj_data` Docker volume persists the SQLite database, uploaded images, and generated backups across container recreations. Back up this volume off the VM regularly; a VM or volume failure can otherwise lose the data. To check the app locally on the VM, use `curl http://127.0.0.1:3000/healthz`.

For local Docker testing without a reverse proxy, use `TRUST_PROXY=0`, bootstrap the first Super Admin, and open `http://localhost:3000`:

```powershell
docker compose run --rm web npm run setup-admin -- --role superadmin
docker compose up --build
```

The container runs as a non-root user and does not include the local database file in its image.

Optional environment variables:

- `PORT`: HTTP port (default `3000`).
- `DB_PATH`: SQLite database path (default `auth.db` in the project directory).
- `NOTIF_API_KEY`: enables the API-key-protected notification creation endpoint.
- `TRUST_PROXY=1`: only when running behind a trusted reverse proxy that terminates HTTPS.

## Smoke test

Start the application, then run in another terminal:

```powershell
npm run smoke
```

The smoke test checks the homepage, anonymous access restrictions, database-file exposure, and the notification API-key requirement.

For isolated admin API integration coverage, run:

```powershell
npm run test:admin
```

It starts a temporary server and database, exercises the admin APIs and role boundaries, then removes its temporary test data.
