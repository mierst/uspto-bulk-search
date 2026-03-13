# USPTO Bulk Search — SaaS Web Version Design

## Context

The USPTO Bulk Search tool is currently an Electron desktop app used by IP attorneys for trademark clearance searches. The goal is to create a SaaS web version hosted at **https://uspto-search.live** on a single DigitalOcean droplet (4GB RAM recommended, 2GB minimum), alongside the existing desktop app. Both will share a common core of business logic via a monorepo structure.

**Motivation**: Make the tool accessible to anyone with a browser, without requiring a desktop install.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Monorepo with shared `core/` | One source of truth for business logic |
| Auth | Google OAuth 2.0 | Simple, widely trusted, no password management |
| Backend | Node/Express + SQLite (better-sqlite3) | Closest to existing codebase, minimal dependencies |
| Frontend | React + Vite (reuse existing components) | UI already exists and works |
| WAF strategy | Puppeteer on the VM | Direct translation of Electron's hidden BrowserWindow approach |
| Multi-tenancy | Single DB, user_id column | Standard approach for small SaaS |
| File storage | Local filesystem on VM | Simple, no extra services needed |
| Access model | Free, open access | Anyone with a Google account can sign up |
| Domain | `uspto-search.live` | TLS via Let's Encrypt / Certbot |

## Monorepo Structure

```
packages/
  core/                         # Shared business logic (pure Node.js)
    src/
      database.js               # SQLite via better-sqlite3, multi-tenant
      session-manager.js        # Puppeteer WAF challenge solver
      uspto-client.js           # Search, TSDR, downloads (uses session-manager)
      assignment-engine.js      # normalizeAssignment, buildChainOfTitle
      file-manager.js           # File storage operations
      pdf-extractor.js          # PDF text extraction (pdf-parse)
      exhibit-exporter.js       # PDF generation (pdfkit)
      constants.js              # Shared config (URLs, rate limits)
      types.js                  # JSDoc typedefs
    package.json

  desktop/                      # Electron app (thin shell)
    src/
      main/
        index.js                # Electron main process + auto-updater
        ipc-handlers.js         # IPC channels → core function calls
        preload.js              # Context bridge
      renderer/                 # Symlink or import from shared components
    electron-builder.yml
    package.json

  web/                          # SaaS web app
    server/
      index.js                  # Express entry point
      routes/
        auth.js                 # Google OAuth endpoints
        search.js               # /api/search, /api/case/:id
        projects.js             # /api/projects CRUD
        assignments.js          # /api/projects/:id/assignments
        files.js                # /api/files, /api/download
        export.js               # /api/export/exhibit
        batch.js                # /api/batch (SSE progress)
      middleware/
        auth.js                 # JWT verification middleware
        rate-limit.js           # Per-user rate limiting
        error-handler.js        # Centralized error handling
      auth.js                   # Passport Google OAuth config
    client/
      src/
        components/             # React components (shared with desktop)
        api.js                  # fetch() wrapper replacing window.api
        App.jsx                 # Web-specific App with react-router
        main.jsx                # Vite entry point
      index.html
      vite.config.js
    package.json
```

### Notes on search-index.js

The existing `search-index.js` is a trivial passthrough to `database.localSearch()`. It will be inlined into the database module rather than carried as a separate core module. The `flexsearch` dependency in `package.json` appears to be dead code and will be removed.

## Core Package Changes

### database.js — sql.js to better-sqlite3

**Why**: sql.js requires manual `db.export()` after every write and holds the entire DB in memory. better-sqlite3 writes directly to the file, is synchronous (no async overhead), and handles concurrent reads safely. Schema is identical.

**WAL mode enabled** for concurrent read performance under multi-user load:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

**Multi-tenancy**: Every table gets a `user_id` column. All query functions accept `userId` as the first parameter. Desktop app passes a sentinel value (`user_id = 1`, a pre-seeded local user row) to avoid NULL fragility. Desktop and web use separate database files — they never share.

**New table**:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

**Existing tables modified**:
```sql
ALTER TABLE projects ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id);
ALTER TABLE assignments ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id);
ALTER TABLE downloads ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_assignments_user ON assignments(user_id);
CREATE INDEX idx_downloads_user ON downloads(user_id);
```

Every query appends `WHERE user_id = ?`.

### session-manager.js — Puppeteer replaces BrowserWindow

Replaces Electron's hidden `BrowserWindow` approach with Puppeteer:

```javascript
const puppeteer = require('puppeteer');

let browser, page, cookies;

async function initSession() {
  browser = await puppeteer.launch({
    headless: 'new',  // New headless mode — better WAF fingerprint than old headless
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',  // Prevent /dev/shm exhaustion on small VMs
      '--disable-gpu',
    ],
  });
  page = await browser.newPage();
  // Set realistic user-agent to avoid WAF detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  await page.goto(TMSEARCH_PAGE, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 4000));  // WAF challenge execution
  cookies = await page.cookies();
}

function getSessionCookies() {
  return cookies;
}
```

**Session lifecycle**:
- Single Chromium instance, reused across all users
- Cookies refreshed every 30 minutes via a `setInterval`
- On 403 response from USPTO, auto-reinitialize session and retry
- Health check: if `browser.isConnected()` returns false, restart Chromium
- On Chromium crash, auto-restart via PM2 (whole process restarts)

**WAF risk**: Headless Chromium may be detected by USPTO's WAF. Mitigations: `headless: 'new'` (improved fingerprint), realistic user-agent, `networkidle0` wait. **Fallback**: if headless fails, run with `headless: false` using `xvfb-run` (virtual framebuffer) on the VM.

**Memory budget**: Puppeteer with `headless: 'new'` + flags above uses ~200-350MB. This is why 4GB RAM is recommended (2GB minimum, tight).

### uspto-client.js — Electron dependency removed

- Remove `const { BrowserWindow, session } = require('electron')`
- Import `session-manager` instead
- Accept cookies from `session-manager.getSessionCookies()` and pass via `Cookie` header in `fetch()` requests
- Rate limiter (bottleneck) preserved as-is
- `normalizeSearchResults` unchanged

**Note**: `assignment-engine.js` imports `uspto-client.js`, so it has a transitive Electron dependency today. Once `uspto-client.js` is refactored, both can move to `core/` together. `assignment-engine.js` itself needs no logic changes, only the import path changes.

### pdf-extractor.js — Move to core as-is

Uses `pdf-parse` (pure Node.js). Extracts text from downloaded PDFs for search indexing. No Electron dependencies.

### Other services — Move to core as-is

`exhibit-exporter.js` (pdfkit), `file-manager.js` (fs operations) — pure Node.js, no changes needed beyond import paths.

### Dependencies to clean up

- Remove `flexsearch` (unused, `LIKE`-based search used instead)
- `papaparse` used by batch import CSV parsing — keep in core

## Auth Flow

### Google OAuth 2.0 + JWT Sessions

1. User clicks "Sign in with Google" on the web app
2. Browser redirects to `GET /api/auth/google` → Google consent screen
3. Google redirects to `GET /api/auth/google/callback` with auth code
4. Server exchanges code for profile (email, name, avatar)
5. Server upserts user in `users` table, updates `last_login`
6. Server issues JWT (contains `userId`, `email`), stored in httpOnly secure cookie
7. All `/api/*` routes require valid JWT (middleware check)
8. `GET /api/auth/me` returns current user from JWT
9. `POST /api/auth/logout` clears the cookie

**JWT expiry**: 7 days. Sliding window — each successful API request reissues a fresh 7-day cookie. If the user is inactive for 7+ days, they re-authenticate via Google (one click).

**401 handling**: Frontend `api.js` wrapper detects 401 responses and redirects to `/login`.

**Dependencies**: `passport`, `passport-google-oauth20`, `jsonwebtoken`, `cookie-parser`

### Google OAuth Setup

Requires a Google Cloud Console project with OAuth 2.0 credentials:
- Client ID and Client Secret stored as environment variables
- Authorized redirect URI: `https://uspto-search.live/api/auth/google/callback`

## API Design

All endpoints require authentication (JWT cookie) except `/api/auth/*`.

### Error Response Contract

All errors return:
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

Standard codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `RATE_LIMITED` (429), `VALIDATION_ERROR` (422), `INTERNAL_ERROR` (500).

### Auth
```
GET  /api/auth/google              → Redirect to Google OAuth
GET  /api/auth/google/callback     → OAuth callback, set JWT cookie, redirect to /
GET  /api/auth/me                  → Current user profile { id, email, name, avatar }
POST /api/auth/logout              → Clear JWT cookie
```

### Search
```
GET  /api/search?q=&status=&markType=&intClass=&owner=&filedAfter=&filedBefore=&from=0&size=50
     → USPTO trademark search (proxied through server)

GET  /api/case/:serialNumber/status
     → TSDR case status (proxied through server)

GET  /api/search/local?q=
     → Search user's saved assignments and downloads
```

### Projects
```
POST   /api/projects               → Create project { name, searchTerms }
POST   /api/projects/find-or-create → Find by name or create { name, searchTerms }
GET    /api/projects               → List user's projects
GET    /api/projects/:id           → Get project by ID (scoped to user)
PUT    /api/projects/:id           → Rename project { name }
DELETE /api/projects/:id           → Delete project + all files
```

### Assignments
```
GET    /api/projects/:id/assignments     → List assignments in project
POST   /api/projects/:id/assignments     → Save assignment to project
GET    /api/assignments/projects/:serial → Find projects containing serial number
```

### Files
```
GET    /api/files/stats                  → Storage stats for user
GET    /api/projects/:id/files           → List files in project
GET    /api/downloads                    → List all downloads across projects
DELETE /api/files/:id                    → Delete a file
POST   /api/download                     → Download file from USPTO URL to project
```

### Export
```
POST   /api/export/exhibit               → Generate chain-of-title PDF
     → Returns PDF as download (Content-Disposition: attachment)
```

### Settings
```
GET    /api/settings                     → Get user settings (account info)
PUT    /api/settings                     → Update settings (e.g. USPTO API key)
```

### Batch
```
POST   /api/batch                        → Start batch search
     → Returns SSE stream with progress events
     Content-Type: text/event-stream
     data: {"type":"progress","current":3,"total":10,"mark":"BATMAN"}
     data: {"type":"complete","projectId":42}
```

### Electron-specific channels NOT ported to web

These IPC channels are desktop-only and have no web equivalents:
- `shell:openExternal` → Web uses plain `<a href target="_blank">` links
- `tmsearch:open` → Web uses plain `<a href>` (browser already has its own session)
- `settings:chooseSaveLocation` → No save location needed on web
- `update:*` channels → No auto-updater on web
- `app:version` → Web serves version from build-time constant

## Frontend Changes

### api.js — Replaces window.api

```javascript
const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res;
}

export const api = {
  searchUSPTO: (query, options) =>
    request(`${API_BASE}/search?${buildParams(query, options)}`).then(r => r.json()),
  createProject: (name, searchTerms) =>
    request(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, searchTerms }),
    }).then(r => r.json()),
  // ... same interface for all methods
};
```

Components switch from `window.api.xxx()` to `import { api } from '../api'; api.xxx()`. The method signatures stay identical.

### CORS

Development: `cors({ origin: 'http://localhost:5173', credentials: true })` middleware on Express.
Production: Same-origin via Nginx proxy, no CORS needed.

### React Router

Add `react-router-dom` for URL-based navigation:

```
/login               → LoginPage (Google sign-in)
/                    → Search (default, protected)
/batch               → Batch Import
/projects            → Projects list
/projects/:id        → Project detail
/files               → File Manager
/settings            → Settings (account info)
/assignment/:serial  → Assignment detail
```

### Shared Components

Components reused in both desktop and web:
- `SearchPanel`, `ResultsList`, `AssignmentView`, `ProjectDetail`
- `FileManager`, `BatchImport`, `Sidebar`

Web-specific:
- `LoginPage` — Google sign-in button
- `NavBar` — user avatar + logout (replaces Electron title bar)

Desktop-specific (not shared):
- `SetupWizard` — save location picker
- Auto-update banner logic in `App.jsx`

Adapted for web:
- `Settings` — web shows account info instead of save location
- `Sidebar` — web version hides update check, shows user info
- External links: `openExternal()` calls become `<a href>` / `window.open()`

### Search History

Stays in `localStorage` (per-browser). No server-side storage needed.

## Deployment

### Domain: `uspto-search.live`

### VM Setup (DigitalOcean $24/mo, 4GB RAM recommended)

```
Ubuntu 22.04 LTS
├── Nginx (reverse proxy, TLS termination, static file serving)
├── Node.js 20 LTS (Express server on port 3000)
├── Chromium (installed for Puppeteer, ~200-350MB RAM)
├── PM2 (process manager, auto-restart on crash)
└── Certbot (Let's Encrypt auto-renewal)
```

A 2GB droplet ($12/mo) works but is tight with Puppeteer. 4GB ($24/mo) recommended.

### TLS Setup (Let's Encrypt)

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d uspto-search.live
# Auto-renewal via systemd timer (installed by default)
```

### Nginx Config
```nginx
server {
    listen 443 ssl;
    server_name uspto-search.live;

    ssl_certificate /etc/letsencrypt/live/uspto-search.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/uspto-search.live/privkey.pem;

    # Serve built SPA
    location / {
        root /opt/uspto-search/packages/web/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;                   # Required for SSE
        proxy_set_header X-Accel-Buffering no; # Required for SSE
    }
}

server {
    listen 80;
    server_name uspto-search.live;
    return 301 https://$host$request_uri;
}
```

### Data Layout
```
/opt/uspto-search/              # Application code (git repo)
/opt/uspto-search-data/
  uspto-search.db               # SQLite database (WAL mode)
  files/{userId}/               # User file storage
    {projectName}-{date}/
      assignments/
      downloads/
      exports/
  backups/                      # Daily SQLite backups
```

### Backup Strategy

Daily cron job backs up the SQLite database:
```bash
# /etc/cron.daily/uspto-backup
sqlite3 /opt/uspto-search-data/uspto-search.db ".backup /opt/uspto-search-data/backups/db-$(date +%Y%m%d).bak"
find /opt/uspto-search-data/backups -mtime +7 -delete  # Keep 7 days
```

### Per-User Storage Quota

50MB per user (file downloads). Enforced at the API layer before saving files. Prevents disk exhaustion on the VM.

### Environment Variables
```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
JWT_SECRET=xxx
DATA_DIR=/opt/uspto-search-data
NODE_ENV=production
PORT=3000
DOMAIN=https://uspto-search.live
```

## Rate Limiting

Two layers:
1. **USPTO rate limits** (preserved from desktop): bottleneck, 60 req/min general, 4 req/min downloads — shared across all users since they share the same Puppeteer session
2. **Per-user API rate limits** (new): express-rate-limit, 100 API requests/min per user to prevent abuse

## Security Considerations

- All cookies httpOnly + Secure + SameSite=Strict
- CSRF protection via SameSite cookies (no separate CSRF token needed)
- User data isolation enforced at the database query level (every query includes `WHERE user_id = ?`)
- File paths validated to prevent directory traversal
- USPTO API key (if provided) stored per-user in the users table, never exposed to the client
- Puppeteer runs as non-root user; `--no-sandbox` flag disables Chromium sandbox (acceptable since we control the input URLs — only navigates to `tmsearch.uspto.gov`)
- HTTPS enforced via Nginx redirect (80 → 443)

## Migration Path

The desktop app continues to work unchanged. The conversion is additive:

1. Extract `core/` package from existing `src/main/services/` and `src/shared/`
2. Adapt `desktop/` to import from `core/` instead of relative paths
3. Build `web/` server and client using `core/`
4. Deploy to VM

Existing Electron users are unaffected. The desktop app keeps its own SQLite file, local filesystem, and auto-updater.

## Verification

1. **Core package**: Run existing Vitest tests against the extracted core (they should pass with minimal changes)
2. **Desktop app**: Run `npm run dev` from `packages/desktop/`, verify all features still work
3. **Web API**: Test each endpoint with curl, verify auth flow end-to-end with real Google OAuth
4. **Web frontend**: Run `npm run dev` from `packages/web/`, verify search, save, batch all work through the browser
5. **Deployment**: Deploy to DigitalOcean droplet, verify `https://uspto-search.live` serves the app
6. **Multi-tenancy**: Create two test Google accounts, verify complete data isolation
7. **Puppeteer WAF**: Verify the headless session successfully solves the USPTO WAF challenge on the VM
