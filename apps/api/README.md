# SolarTrack - FastAPI Backend

## Setup

### 1. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment
Copy `.env.example` to `.env` and update with your local Supabase credentials:
```bash
cp .env.example .env
```

Get your Supabase local credentials by running:
```bash
supabase status
```

Then fill in the `.env` file with:
- `SUPABASE_URL`: From `Supabase API URL` (usually http://localhost:54321)
- `SUPABASE_SERVICE_KEY`: From `service_role key`
- `SUPABASE_JWT_SECRET`: From `JWT Secret`

### 4. Run the Server
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

Visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI)

## Health Check

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00",
  "environment": "development",
  "ai_provider": "mock"
}
```

## Project Structure

```
app/
├── main.py           # FastAPI application and routes
├── config.py         # Settings from environment variables
├── services/         # Business logic
│   └── ai/          # AI provider implementations
│       ├── base.py  # Abstract AI provider interface
│       └── mock.py  # Mock provider for testing
└── middleware/      # Middleware (auth, error handling, etc.)
```

## Development

### Running in Development Mode
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The `--reload` flag enables auto-reload on file changes.

### Testing
```bash
# (Will add pytest configuration later)
```
