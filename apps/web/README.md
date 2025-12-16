# SolarLog AI - Next.js Frontend

## Setup

### 1. Install Dependencies
```bash
cd apps/web
pnpm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and update with your local Supabase credentials:
```bash
cp .env.example .env.local
```

Get your Supabase local credentials by running:
```bash
supabase status
```

Then fill in the `.env.local` file with:
- `NEXT_PUBLIC_SUPABASE_URL`: From `Supabase API URL` (usually http://localhost:54321)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: From `anon key`

### 3. Run the Development Server
```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

## Features

- Next.js 15 with App Router
- shadcn/ui components for clean VC startup aesthetic
- Tailwind CSS for styling
- Supabase integration for authentication and data
- React Query for server state management
- Zustand for client state management
- Recharts for data visualization
- Dark/Light mode support

## Project Structure

```
app/
├── layout.tsx        # Root layout
├── page.tsx          # Home page
├── (auth)/           # Auth route group
│   ├── login/
│   └── signup/
└── (app)/            # Protected app routes
    ├── dashboard/
    ├── database/
    ├── upload/
    └── settings/

lib/
├── api/              # API client utilities
├── supabase/         # Supabase client
└── hooks/            # Custom React hooks

components/
├── ui/               # shadcn/ui components
└── dashboard/        # Dashboard components
```

## Development

### Building
```bash
pnpm build
```

### Linting
```bash
pnpm lint
```

### Type Checking
```bash
pnpm type-check
```

## Styling

This project uses:
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **CSS Variables** - For theme customization

### Color Scheme
- Light mode: White background, black text
- Dark mode: Black background, white text
- Accent: Solar yellow/orange (#FF9500)

## API Integration

The frontend connects to the FastAPI backend at `http://localhost:8000`

See `lib/api/client.ts` for API utilities.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL         - Supabase project URL (local)
NEXT_PUBLIC_SUPABASE_ANON_KEY    - Supabase anonymous key
NEXT_PUBLIC_API_URL              - Backend API URL
NEXT_PUBLIC_MODE                 - development or production
```
