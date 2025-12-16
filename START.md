# Quick Start Guide

Once you've completed the setup from `SETUP.md`, use this guide to start the local development environment.

## Prerequisites (First Time Only)

1. Install Supabase CLI: `brew install supabase/tap/supabase`
2. Install Node.js dependencies: `cd apps/web && pnpm install`
3. Create Python venv and install: `cd apps/api && python -m venv venv && pip install -r requirements.txt`
4. Create `.env.local` and `.env` files (see SETUP.md)

## Starting the Stack

You need **3 terminal windows**. In each directory, run the corresponding command:

### Terminal 1: Supabase
```bash
cd /Users/prawat/Local/Repositories/SolarTrack
supabase start
```

Wait for the output showing all services are healthy.

### Terminal 2: FastAPI Backend
```bash
cd /Users/prawat/Local/Repositories/SolarTrack/apps/api
source venv/bin/activate
uvicorn app.main:app --reload
```

Wait for: `Uvicorn running on http://0.0.0.0:8000`

### Terminal 3: Next.js Frontend
```bash
cd /Users/prawat/Local/Repositories/SolarTrack/apps/web
pnpm dev
```

Wait for: `Local: http://localhost:3000`

## Access Your Development Environment

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Supabase Studio**: http://localhost:54323

## Stopping

Press `Ctrl+C` in each terminal, or run:
```bash
supabase stop
```

## Checking Status

```bash
# Terminal 1: Check Supabase
supabase status

# Terminal 2: Check Backend (running = ✓)
curl http://localhost:8000/health

# Terminal 3: Check Frontend (running = ✓)
curl http://localhost:3000
```

## Resetting Database

```bash
supabase db reset
```

This will re-apply all migrations and give you a clean slate.

## Useful Commands

```bash
# View Supabase logs
supabase logs local

# Open Supabase Studio
supabase studios

# Get current Supabase credentials
supabase status

# Stop Supabase and remove containers
supabase stop --no-backup
```

## Next Steps

Start building features! Check `IMPLEMENTATION_PLAN.md` for what to work on next.
