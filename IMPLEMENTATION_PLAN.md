# SolarTrack - Complete Rebuild Plan

## Project Overview

Rebuilding SolarTrack from scratch with modern, production-ready tech stack:
- **Frontend:** Next.js 15 (App Router) + shadcn/ui + Tailwind CSS → Vercel
- **Backend:** Python FastAPI → Railway
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Provider-agnostic (Gemini, OpenAI, Claude, Local models)
- **Mode:** Environment flag for offline (testing) vs production

Current state: Empty folder at `/Users/prawat/Local/Repositories/SolarTrack`
Reference MVP: `/Users/prawat/Downloads/solarlog-ai/` (React + localStorage + Gemini)

---

## Architecture Summary

### Monorepo Structure
```
solarlog-ai/
├── apps/web/           # Next.js 15 frontend
├── apps/api/           # FastAPI backend
├── packages/shared/    # Shared TypeScript types
├── supabase/          # Database migrations
└── .github/workflows/ # CI/CD
```

### Tech Stack
- **Frontend:** Next.js 15, React Query, Zustand, shadcn/ui, Tailwind, Recharts
- **Backend:** FastAPI, Pydantic, Python 3.12, Supabase client
- **Database:** Supabase (PostgreSQL with RLS)
- **Auth:** Supabase Auth (JWT)
- **Storage:** Supabase Storage (images)
- **AI:** Gemini (default), OpenAI, Claude, Local (Ollama), Mock (testing)
- **Deploy:** Vercel (frontend), Railway (backend), GitHub Actions (CI/CD)

### Key Architectural Decisions
1. **Provider-agnostic AI service layer** - Abstract interface with multiple implementations
2. **Offline mode via environment flag** - Mock services for local testing without API costs
3. **Monorepo with shared types** - Single source of truth for data models
4. **Supabase RLS** - Row-level security for multi-tenant data isolation
5. **React Query for server state** - Caching, optimistic updates, real-time sync
6. **shadcn/ui components** - VC startup aesthetic (clean, minimal, black/white)

---

## Database Schema (Supabase)

### Tables

**user_settings**
- id (UUID, PK)
- user_id (UUID, FK to auth.users, UNIQUE)
- currency_symbol (VARCHAR, default '$')
- cost_per_kwh (DECIMAL, default 0.15)
- co2_factor (DECIMAL, default 0.85)
- yearly_goal (DECIMAL, default 12000)
- theme (VARCHAR, default 'dark')
- created_at, updated_at (TIMESTAMPTZ)

**solar_readings**
- id (UUID, PK)
- user_id (UUID, FK to auth.users)
- date (DATE)
- value (DECIMAL)
- unit (VARCHAR, default 'kWh')
- notes (TEXT, nullable)
- source_image_id (UUID, FK to images, nullable)
- is_verified (BOOLEAN, default false)
- created_at, updated_at (TIMESTAMPTZ)
- **Index:** (user_id, date DESC), (user_id, created_at DESC)

**images**
- id (UUID, PK)
- user_id (UUID, FK to auth.users)
- storage_path (TEXT) - Supabase Storage path
- filename (VARCHAR)
- mime_type (VARCHAR)
- size_bytes (INTEGER)
- status (VARCHAR) - pending, processing, processed, error
- error_message (TEXT, nullable)
- processed_at (TIMESTAMPTZ, nullable)
- created_at (TIMESTAMPTZ)

**processing_jobs**
- id (UUID, PK)
- user_id (UUID, FK to auth.users)
- image_id (UUID, FK to images)
- provider (VARCHAR) - gemini, openai, anthropic, local, mock
- status (VARCHAR) - pending, running, completed, failed
- result (JSONB) - Extracted readings
- error (TEXT, nullable)
- started_at, completed_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)

### Row-Level Security (RLS)
All tables have RLS enabled with policies:
- Users can only SELECT/INSERT/UPDATE/DELETE their own data (WHERE auth.uid() = user_id)

### Storage Bucket
- **Bucket:** `solar-images` (private)
- **Path structure:** `{user_id}/{image_id}.{ext}`
- **Policies:** Users can upload/view/delete only their own images

---

## API Design (FastAPI)

### Base URL
- Production: `https://api.solartrack.railway.app`
- Development: `http://localhost:8000`

### Authentication
- Method: JWT Bearer Token (from Supabase Auth)
- Header: `Authorization: Bearer <access_token>`
- Middleware validates JWT using Supabase JWT secret

### Key Endpoints

**Readings**
- `GET /api/readings` - List readings (query: start_date, end_date, limit, offset)
- `POST /api/readings` - Create single reading
- `POST /api/readings/bulk` - Create multiple readings
- `PATCH /api/readings/{id}` - Update reading
- `DELETE /api/readings/{id}` - Delete reading

**Upload & Processing**
- `POST /api/upload` - Upload images (multipart/form-data)
- `POST /api/process` - Start AI processing (body: image_ids, provider)
- `GET /api/process/{job_id}` - Get job status and results
- `POST /api/process/commit` - Save verified readings to database

**Settings**
- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update settings

**Export**
- `GET /api/export/csv` - Download CSV (query: start_date, end_date)

**Health**
- `GET /health` - Health check

### AI Provider Abstraction

**Abstract Interface** (`app/services/ai/base.py`):
```python
class AIProvider(ABC):
    @abstractmethod
    async def extract_readings(
        self, image_data: bytes, mime_type: str, prompt: str
    ) -> List[ExtractedReading]:
        pass
```

**Implementations:**
- `GeminiProvider` - Google Gemini 2.5 Flash
- `OpenAIProvider` - GPT-4 Vision
- `AnthropicProvider` - Claude 3.5 Sonnet
- `LocalProvider` - Ollama/LM Studio (OpenAI-compatible API)
- `MockProvider` - Fake data for testing

**Factory Pattern:**
```python
AIProviderFactory.create(provider_name) # Returns correct provider
```

---

## Frontend Architecture (Next.js 15)

### Route Structure

**Route Groups:**
- `(auth)/` - Public pages (login, signup)
- `(app)/` - Protected pages (dashboard, database, upload, settings)

**Routes:**
- `/` - Landing page
- `/login` - Login page
- `/signup` - Signup page
- `/dashboard` - Main dashboard (charts, stats, recent readings)
- `/database` - Full CRUD interface (search, filter, export)
- `/upload` - Upload & review flow
- `/settings` - User settings
- `/report` - Printable Solar Legacy Report

### Server vs Client Components

**Server Components:**
- Page shells (layout wrappers)
- Initial data fetching from Supabase
- Static content

**Client Components:**
- Forms (upload, edit)
- Charts (Recharts)
- Interactive UI (dialogs, dropdowns)
- Theme toggle
- Real-time updates

### State Management

**React Query:**
- Server state (readings, settings, images, jobs)
- Caching and invalidation
- Optimistic updates
- Prefetching

**Zustand:**
- UI state (modals, theme)
- Upload queue state
- Review stage state (selected readings, zoom)

### Environment-Based Feature Flags

```typescript
// lib/constants.ts
export const IS_OFFLINE_MODE = process.env.NEXT_PUBLIC_MODE === 'offline';
export const API_BASE_URL = IS_OFFLINE_MODE ? '/api/mock' : process.env.NEXT_PUBLIC_API_URL;

// lib/api/client.ts
export const apiClient = IS_OFFLINE_MODE ? mockClient : realClient;
```

**Offline Mode:**
- Mock API responses (no network calls)
- Fake data for testing UI
- No costs for Supabase/Railway/AI

**Production Mode:**
- Real API calls to Railway backend
- Real Supabase database
- Real AI providers

### shadcn/ui Components

**Core components:**
- Button, Card, Input, Textarea, Label
- Dialog, Sheet, Popover, Dropdown Menu
- Table, Tabs, Select, Checkbox
- Toast (notifications)
- Skeleton (loading states)
- Progress (goal tracking)

**Styling:**
- VC startup aesthetic: clean, minimal, black/white
- Dark mode: `bg-black text-white`
- Light mode: `bg-white text-black`
- Accent: Solar yellow/orange (`#FF9500`)

---

## Feature Parity with MVP

All MVP features retained:
- Multi-image upload (drag-and-drop)
- AI OCR processing (split-screen review)
- Dashboard (stats, charts, impact metrics, Hall of Fame, goal tracking)
- Database page (CRUD, search, filter, CSV import/export)
- Printable Solar Legacy Report
- Dark/light theme
- Settings (currency, kWh cost, CO2 factor, yearly goal)

**New features:**
- User authentication (multi-user support)
- Cloud storage (Supabase)
- Provider-agnostic AI (swap Gemini/OpenAI/Claude/Local)
- Offline development mode
- Auto-deploy CI/CD

---

## Deployment Strategy

### GitHub Repository
- **Branches:** main (prod), develop (staging), feature/*
- **Workflow:** Feature → develop (preview) → main (production)

### Vercel (Frontend)
- **Auto-deploy:** Push to main → production deploy
- **Environment variables:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_URL` (Railway backend URL)
  - `NEXT_PUBLIC_MODE=production`

### Railway (Backend)
- **Auto-deploy:** Push to main → production deploy
- **Dockerfile:** Python 3.12-slim with FastAPI
- **Environment variables:**
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY` (admin access)
  - `SUPABASE_JWT_SECRET`
  - `DATABASE_URL`
  - `GEMINI_API_KEY` (optional)
  - `OPENAI_API_KEY` (optional)
  - `ANTHROPIC_API_KEY` (optional)
  - `DEFAULT_AI_PROVIDER=gemini`
  - `ENVIRONMENT=production`

### Supabase
- Create project
- Run migrations from `supabase/migrations/`
- Create storage bucket `solar-images`
- Configure Auth (Email/Password, redirect URLs)
- Copy credentials to Vercel/Railway

### CI/CD (GitHub Actions)
- **Frontend:** Lint, type-check, build, deploy to Vercel
- **Backend:** Lint, test, build Docker, deploy to Railway
- **Triggers:** Push to main/develop

---

## Migration from MVP

### CSV Import Tool
- Settings page → "Import from old SolarLog" button
- Upload CSV file exported from MVP
- Backend bulk inserts into `solar_readings` table
- Success: "Imported 500 readings"

### Data Mapping
- MVP localStorage → Supabase `solar_readings` table
- All fields map 1:1 (id, date, value, unit, notes, is_verified, created_at)

---

## Implementation Phases

### Week 1: Infrastructure & Core Setup
1. **Monorepo setup:**
   - Create folder structure
   - Configure pnpm workspaces
   - Set up shared types package (`packages/shared`)

2. **Supabase setup:**
   - Create project
   - Run migration: `00001_initial_schema.sql`
   - Configure storage bucket `solar-images`
   - Set up RLS policies

3. **Backend skeleton:**
   - FastAPI app (`apps/api/app/main.py`)
   - Health endpoint (`/health`)
   - Auth middleware (`app/middleware/auth.py`)
   - Mock AI provider (`app/services/ai/mock.py`)

4. **Frontend skeleton:**
   - Next.js 15 app (`apps/web`)
   - Install shadcn/ui components
   - Configure Tailwind (black/white theme)
   - Set up React Query provider

**Critical files to create:**
- `/Users/prawat/Local/Repositories/SolarTrack/supabase/migrations/00001_initial_schema.sql`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/api/app/services/ai/base.py`
- `/Users/prawat/Local/Repositories/SolarTrack/packages/shared/src/types/reading.ts`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/web/lib/supabase/client.ts`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/api/app/main.py`

### Week 2: Authentication & Settings
1. **Supabase Auth:**
   - Login page (`apps/web/app/(auth)/login/page.tsx`)
   - Signup page (`apps/web/app/(auth)/signup/page.tsx`)
   - Protected routes middleware (`apps/web/middleware.ts`)
   - Session management

2. **Settings page:**
   - CRUD for user settings (frontend + backend)
   - Theme toggle (dark/light)
   - Form validation (React Hook Form + Zod)

### Week 3: Upload & AI Processing
1. **Upload flow:**
   - Drag-and-drop component (`components/upload/dropzone.tsx`)
   - Multi-image upload to Supabase Storage
   - Progress indicators
   - Backend endpoint: `POST /api/upload`

2. **AI processing:**
   - Implement Gemini provider (`app/services/ai/gemini.py`)
   - Create processing jobs (`POST /api/process`)
   - Poll for job completion (`GET /api/process/{job_id}`)

3. **Review stage:**
   - Split-screen layout (`components/review/split-screen.tsx`)
   - Image viewer (left pane, zoomable)
   - Data table (right pane, editable)
   - Select/deselect readings
   - Commit endpoint: `POST /api/process/commit`

### Week 4: Dashboard & Visualizations
1. **Stats cards:**
   - Total kWh, money saved, trees planted
   - Add readings button (toggle upload panel)

2. **Charts:**
   - Daily/weekly/monthly/yearly production trends
   - Year-over-year comparison
   - Recharts integration

3. **Impact metrics:**
   - Electric miles driven
   - Homes powered for a year
   - Coal offset (lbs)

4. **Hall of Fame:**
   - Best production day (date + kWh)
   - Best production month (YYYY-MM + kWh)

5. **Goal tracking:**
   - Progress bar for yearly goal
   - Current year total vs goal

### Week 5: Database & Export
1. **Database page:**
   - Readings table with pagination
   - Search (notes/values)
   - Date range filter
   - Sort (newest/oldest)
   - Inline editing
   - Delete with confirmation

2. **CSV export/import:**
   - Export all readings to CSV (`GET /api/export/csv`)
   - Import CSV (bulk insert via `POST /api/readings/bulk`)
   - Migration tool for MVP users

### Week 6: Polish & Deploy
1. **Printable report:**
   - Solar Legacy Report component
   - Print-optimized styling
   - Auto-trigger print dialog

2. **Error handling:**
   - Toast notifications (shadcn/ui Toaster)
   - Error boundaries
   - Retry logic for failed AI jobs

3. **Deployment:**
   - Deploy frontend to Vercel
   - Deploy backend to Railway
   - Configure environment variables
   - Test production environment

4. **Documentation:**
   - User guide (how to use the app)
   - API documentation (endpoint specs)
   - Deployment runbook (for developers)

---

## Critical Dependencies

```
1. Supabase Schema → Auth Integration → Protected Routes
2. Backend Setup → AI Provider → Upload Flow
3. Upload Flow → Review Stage → Database Storage
4. Database Storage → Dashboard Charts
5. Settings CRUD → Impact Calculations
```

---

## Next Steps (Immediate Actions)

1. **Create monorepo structure** in `/Users/prawat/Local/Repositories/SolarTrack/`
2. **Set up Supabase project** and run initial migration
3. **Scaffold Next.js app** (`apps/web`) with shadcn/ui
4. **Scaffold FastAPI app** (`apps/api`) with mock AI provider
5. **Create shared types package** (`packages/shared`)
6. **Begin Week 1 implementation tasks**

---

## File Paths Reference

### Critical Files (Create First)

**Database:**
- `/Users/prawat/Local/Repositories/SolarTrack/supabase/migrations/00001_initial_schema.sql`

**Backend (FastAPI):**
- `/Users/prawat/Local/Repositories/SolarTrack/apps/api/app/main.py`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/api/app/services/ai/base.py`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/api/app/middleware/auth.py`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/api/requirements.txt`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/api/Dockerfile`

**Frontend (Next.js):**
- `/Users/prawat/Local/Repositories/SolarTrack/apps/web/app/layout.tsx`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/web/lib/supabase/client.ts`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/web/lib/api/client.ts`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/web/middleware.ts`
- `/Users/prawat/Local/Repositories/SolarTrack/apps/web/tailwind.config.ts`

**Shared:**
- `/Users/prawat/Local/Repositories/SolarTrack/packages/shared/src/types/reading.ts`
- `/Users/prawat/Local/Repositories/SolarTrack/packages/shared/src/types/settings.ts`
- `/Users/prawat/Local/Repositories/SolarTrack/packages/shared/src/types/upload.ts`

**Root:**
- `/Users/prawat/Local/Repositories/SolarTrack/package.json` (workspace root)
- `/Users/prawat/Local/Repositories/SolarTrack/pnpm-workspace.yaml`
- `/Users/prawat/Local/Repositories/SolarTrack/.env.example`

---

## Summary

This plan rebuilds SolarTrack as a production-ready, multi-user SaaS application with:
- Modern tech stack (Next.js 15, FastAPI, Supabase)
- Provider-agnostic AI (no vendor lock-in)
- Clean VC startup design (shadcn/ui)
- Offline development mode (cost-effective testing)
- Auto-deploy CI/CD (Vercel + Railway + GitHub Actions)
- Full feature parity with MVP plus user authentication

Implementation timeline: 6 weeks for MVP features, ready for first users.
