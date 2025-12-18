import type { User } from '@supabase/supabase-js'

export const MOCK_USER: User = {
  id: 'mock-user-123',
  email: 'test@localhost.dev',
  app_metadata: {},
  user_metadata: { name: 'Test User' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
}

export const MOCK_TOKEN = 'mock-jwt-token-for-local-dev'

export const isMockAuthEnabled = () =>
  process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'
