# SolarLog AI

**Digitizing handwritten solar production logs with AI**

A modern, full-stack application for converting photos of handwritten solar panel logbooks into structured, searchable databases. Built with Next.js, FastAPI, and Supabase.

## Features

- **AI-Powered OCR**: Extract readings from handwritten log photos using vision AI
- **Split-Screen Review**: Verify extracted data before saving to database
- **Beautiful Dashboard**: Visualize solar production trends and impact metrics
- **Dark/Light Mode**: Clean VC startup aesthetic
- **Local Development**: Everything runs locally via Docker (no cloud required)
- **Provider-Agnostic AI**: Swap between Gemini, OpenAI, Claude, or local models
- **Data Export**: CSV export for portability and backup

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **shadcn/ui** - High-quality React components
- **Tailwind CSS** - Utility-first CSS
- **React Query** - Server state management
- **Zustand** - Client state management
- **Recharts** - Data visualization

### Backend
- **FastAPI** - Modern Python API framework
- **Pydantic** - Data validation
- **Supabase** - PostgreSQL, Auth, Storage

### Infrastructure
- **Docker** - Local Supabase via Docker Compose
- **pnpm** - Fast monorepo package manager

## Quick Start

### 1. Prerequisites
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Verify Docker is running
docker --version
```

### 2. Clone & Setup
```bash
git clone <repo-url>
cd SolarTrack

# Install dependencies
pnpm install
```

### 3. Initialize Supabase
```bash
supabase init
supabase start

# Note the credentials printed out!
supabase status
```

### 4. Create Environment Files
Follow `SETUP.md` to create `.env` files with Supabase credentials.

### 5. Start Development
Open 3 terminals and run:

**Terminal 1:**
```bash
supabase start
```

**Terminal 2:**
```bash
cd apps/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Terminal 3:**
```bash
cd apps/web
pnpm dev
```

Visit `http://localhost:3000`

## Documentation

- **SETUP.md** - Complete setup guide with prerequisites
- **START.md** - Quick reference for starting services
- **IMPLEMENTATION_PLAN.md** - Detailed architecture and roadmap
- **apps/web/README.md** - Frontend documentation
- **apps/api/README.md** - Backend documentation

## Project Structure

```
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # FastAPI backend
├── packages/
│   └── shared/       # Shared TypeScript types
├── supabase/
│   └── migrations/   # Database migrations
├── SETUP.md          # Setup guide
├── START.md          # Quick start
└── IMPLEMENTATION_PLAN.md
```

## Development

### Commands

```bash
# Start all services (from 3 different terminals)
pnpm dev              # Frontend
uvicorn app.main:app --reload  # Backend
supabase start        # Database

# Build for production
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### API Documentation
Visit `http://localhost:8000/docs` for interactive API documentation.

### Database Management
Visit `http://localhost:54323` to access Supabase Studio.

## Features (MVP)

- [x] Monorepo with pnpm workspaces
- [x] Local Supabase (PostgreSQL + Auth + Storage)
- [x] FastAPI backend with health endpoint
- [x] Next.js frontend with shadcn/ui
- [x] Shared TypeScript types
- [ ] Authentication (Phase 2)
- [ ] Upload & AI processing (Phase 3)
- [ ] Dashboard with charts (Phase 4)
- [ ] Database CRUD (Phase 5)
- [ ] Printable reports (Phase 6)

## Environment Variables

### Frontend (`apps/web/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MODE=development
```

### Backend (`apps/api/.env`)
```
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=your_key_here
SUPABASE_JWT_SECRET=your_secret_here
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DEFAULT_AI_PROVIDER=mock
ENVIRONMENT=development
```

## Troubleshooting

### Port Already in Use
```bash
supabase stop
docker ps | grep supabase
docker kill <container>
supabase start
```

### Connection Refused
Ensure all three services are running:
```bash
supabase status
curl http://localhost:8000/health
curl http://localhost:3000
```

### Database Reset
```bash
supabase db reset
```

## License

MIT

## Support

For issues or questions:
1. Check SETUP.md troubleshooting section
2. Review service-specific READMEs
3. Check environment variables match `supabase status` output
