# SolarTrack - Local Development Setup Guide

## Overview

This guide will help you set up the complete SolarTrack development environment locally with:
- **Supabase** (PostgreSQL, Auth, Storage) via Docker
- **FastAPI** backend on `localhost:8000`
- **Next.js** frontend on `localhost:3000`

All services run locally with no cloud dependencies.

## Prerequisites

Make sure you have installed:
- Node.js 20+ and pnpm
- Python 3.10+
- Docker (for Supabase)
- Supabase CLI

### Install Supabase CLI
```bash
brew install supabase/tap/supabase
```

### Verify Docker
```bash
docker --version
docker ps  # Should show Docker is running
```

## Step 1: Initialize Supabase Locally

```bash
cd /Users/prawat/Local/Repositories/SolarTrack

# Initialize Supabase project
supabase init

# Start Supabase containers
supabase start
```

The first time you run this, it will:
1. Download and run PostgreSQL, Auth, and other Supabase services in Docker
2. Apply initial migrations
3. Print out credentials (copy these!)

**Note the output - you'll need:**
```
Supabase API URL: http://localhost:54321
Supabase GraphQL URL: http://localhost:54321/graphql/v1
Supabase Key (anon): eyJhbGc...
Supabase Key (service_role): eyJhbGc...
Supabase JWT Secret: super-secret-jwt-token-with-at-least-32-characters-long
```

## Step 2: Get Supabase Credentials

```bash
# View credentials for currently running Supabase
supabase status
```

This will show you all the keys and URLs you need.

## Step 3: Create Environment Files

### Frontend (.env.local)
```bash
cd apps/web
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste_anon_key_from_supabase_status>
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MODE=development
EOF
```

### Backend (.env)
```bash
cd ../api
cat > .env << EOF
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=<paste_service_role_key_from_supabase_status>
SUPABASE_JWT_SECRET=<paste_jwt_secret_from_supabase_status>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DEFAULT_AI_PROVIDER=mock
ENVIRONMENT=development
EOF
```

## Step 4: Install Dependencies

### Frontend
```bash
cd apps/web
pnpm install
```

### Backend
```bash
cd ../api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Step 5: Run All Services

You'll need **3 terminal windows** running simultaneously:

### Terminal 1: Supabase (should already be running)
```bash
supabase status  # Verify it's running
```

If not running:
```bash
supabase start
```

**Access Supabase Studio** at: `http://localhost:54323`

### Terminal 2: FastAPI Backend
```bash
cd apps/api
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

**API available at:** `http://localhost:8000`
**API Docs at:** `http://localhost:8000/docs`

### Terminal 3: Next.js Frontend
```bash
cd apps/web
pnpm dev
```

**Frontend available at:** `http://localhost:3000`

## Step 6: Verify Everything Works

### Test Supabase Connection
Open Supabase Studio: `http://localhost:54323`
- Sign in with any email (it's local)
- Check that the database tables exist in "SQL Editor"

### Test Backend Health Check
```bash
curl http://localhost:8000/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00",
  "environment": "development",
  "ai_provider": "mock"
}
```

### Test Frontend
Open `http://localhost:3000` in your browser. You should see the SolarTrack landing page.

## Access Points

Once everything is running:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | `http://localhost:3000` | Web application |
| **Backend API** | `http://localhost:8000` | REST API |
| **API Docs** | `http://localhost:8000/docs` | Swagger UI with endpoint documentation |
| **Supabase Studio** | `http://localhost:54323` | Database management UI |
| **PostgreSQL** | `localhost:54322` | Direct database connection |
| **Supabase Auth** | `http://localhost:54321` | Auth API |

## Stopping Services

### Stop All Services
```bash
# Terminal 1: Supabase
supabase stop

# Terminal 2 & 3: Ctrl+C in each terminal
```

## Restarting Services

To restart without losing data:
```bash
supabase start
```

## Reset Database

If you need to reset the database to a clean state:
```bash
supabase db reset
```

This will:
1. Drop all tables
2. Re-apply migrations
3. Reset to initial schema

## Troubleshooting

### "Port 54321 already in use"
Another Supabase instance might be running:
```bash
supabase stop
docker ps | grep supabase
docker kill <container_id>
supabase start
```

### "Connection refused" when accessing backend from frontend
Check that:
1. Backend is running on `localhost:8000`
2. `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`
3. CORS is configured in `apps/api/app/config.py`

### "Can't connect to Supabase"
Check that:
1. Docker is running: `docker ps`
2. Supabase containers are running: `supabase status`
3. `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` in `.env.local`
4. Correct anon key in `.env.local`

### Database migrations not applied
```bash
supabase db reset
```

## Next Steps

Once everything is running:
1. Explore the API docs at `http://localhost:8000/docs`
2. Check Supabase Studio at `http://localhost:54323`
3. Start building features as per the implementation plan

## Local Development Tips

### Hot Reload
- **Frontend**: Changes auto-reload (pnpm dev)
- **Backend**: Changes auto-reload with `--reload` flag (uvicorn)
- **Database**: No hot reload needed - just update migrations

### Testing Supabase Auth
Supabase local Auth works just like production. You can:
1. Sign up with any email (no real email verification needed)
2. Log in with that email + password
3. Auth tokens are stored in browser localStorage

### Resetting Everything
```bash
# Clean slate
supabase stop
docker volume prune  # Remove Docker volumes
supabase start       # Fresh database
```

## Documentation

- Frontend: `/apps/web/README.md`
- Backend: `/apps/api/README.md`
- Implementation Plan: `/IMPLEMENTATION_PLAN.md`

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Check service-specific READMEs
3. Verify environment variables match credentials from `supabase status`
4. Restart all services
