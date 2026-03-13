# USPTO Bulk Search - Trademark Clearance Tool

## Project Overview
Electron + React desktop application for IP attorneys/paralegals to perform bulk trademark clearance searches against the USPTO Open Data Portal. Primary feature is retrieving and formatting trademark assignment data for use as exhibits in filings.

## Architecture
- **Main process** (`src/main/`): Electron main process with services for API, database, file management
- **Renderer** (`src/renderer/`): React UI with sidebar navigation layout
- **Database**: SQLite with FTS5 full-text search via `better-sqlite3`
- **API**: USPTO Open Data Portal (`data.uspto.gov/apis/bulk-data/`)

## Commands
- `npm run dev` — Start dev mode (Vite + Electron)
- `npm run build` — Build for production
- `npm start` — Run production build

## Key Patterns
- IPC communication via `contextBridge` in `preload.js` — never expose Node directly to renderer
- Rate limiting via `bottleneck` — 60 req/min general, 4/min for downloads
- All file operations go through `file-manager.js` service
- Database migrations in `src/migrations/` — numbered SQL files run in order
- User data stored in user-chosen directory, not app directory

## File Organization
- User data root contains `.uspto-search.db` (SQLite) and project folders
- Project folders: `{Name}-{YYYY-MM-DD}/` with `assignments/`, `downloads/`, `exports/` subdirs
- Each project has `_project.json` metadata file

## Important
- Never hardcode file paths — use settings for save location
- Always respect USPTO rate limits
- Assignment data is the core feature — prioritize it over general downloads
- PDF exports must be clean enough for legal filings
