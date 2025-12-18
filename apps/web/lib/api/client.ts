import { createClient } from '@/lib/supabase/client'
import { MOCK_TOKEN } from '@/lib/auth/mock-user'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Get authorization headers with Supabase JWT token.
 * Tries getSession first, then falls back to refreshSession if needed.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  // Mock auth for local development
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true') {
    return {
      'Authorization': `Bearer ${MOCK_TOKEN}`,
    }
  }

  const supabase = createClient()

  // Try getSession first
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
    }
  }

  // If no session, try refreshing (handles edge cases after login)
  const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession()

  if (error || !refreshedSession?.access_token) {
    throw new Error('Not authenticated')
  }

  return {
    'Authorization': `Bearer ${refreshedSession.access_token}`,
  }
}

/**
 * Make an authenticated API request.
 */
export async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `API error: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Upload an image for AI processing.
 * Note: Does NOT set Content-Type header (browser sets it with boundary for multipart).
 */
export async function uploadImage(file: File): Promise<UploadResponse> {
  const authHeaders = await getAuthHeaders()
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Upload failed')
  }

  return response.json()
}

// Health check (no auth required)
export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`)
  return response.json()
}

// ============ Types ============

export interface ExtractedReading {
  date: string
  time?: string | null
  m1: number
  m2?: number | null
  notes?: string | null
}

export interface UploadResponse {
  readings: ExtractedReading[]
  provider: string
  message: string
  job_id: string
}

export interface ReadingCreate {
  date: string
  time?: string | null
  m1: number
  m2?: number | null
  notes?: string | null
  is_verified?: boolean
}

export interface ReadingUpdate {
  date?: string
  time?: string | null
  m1?: number
  m2?: number | null
  notes?: string | null
}

export interface ReadingResponse {
  id: string
  user_id: string
  date: string
  time: string | null
  m1: number
  m2: number | null
  notes: string | null
  is_verified: boolean
  // Weather data
  weather_code: number | null
  temp_max: number | null
  sunshine_hours: number | null
  radiation_sum: number | null
  snowfall: number | null
  created_at: string
  updated_at: string
}

export interface ReadingsListResponse {
  data: ReadingResponse[]
  total: number
  limit: number
  offset: number
}

export interface SettingsResponse {
  id: string
  user_id: string
  currency_symbol: string
  cost_per_kwh: number
  co2_factor: number
  yearly_goal: number
  system_capacity: number
  location_name: string
  latitude: number
  longitude: number
  theme: string
}

export interface GeoLocation {
  name: string
  latitude: number
  longitude: number
  country: string
  admin1: string | null
  display_name: string
}

export interface GeoSearchResponse {
  results: GeoLocation[]
}

export interface SettingsUpdate {
  currency_symbol?: string
  cost_per_kwh?: number
  co2_factor?: number
  yearly_goal?: number
  system_capacity?: number
  location_name?: string
  latitude?: number
  longitude?: number
  theme?: string
}

export interface StatsResponse {
  total_m1: number
  total_m2: number
  total_production: number
  money_saved: number
  co2_offset: number
  trees_equivalent: number
  specific_yield: number
  reading_count: number
  first_reading_date: string | null
  last_reading_date: string | null
  yearly_goal: number
  goal_progress: number
  system_capacity: number
  currency_symbol: string
}

export interface TrendDataPoint {
  date: string
  m1: number
  m2: number
  radiation: number  // Solar irradiance in MJ/m²
  snowfall: number   // Daily snowfall in cm
  total: number
}

export interface TrendsResponse {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  data: TrendDataPoint[]
}

export interface RecordEntry {
  value: number
  date: string
}

export interface RecordsResponse {
  best_day: RecordEntry | null
  best_month: RecordEntry | null
}

// ============ API Methods ============

export const readingsAPI = {
  getAll: (params?: {
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }): Promise<ReadingsListResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.start_date) searchParams.set('start_date', params.start_date)
    if (params?.end_date) searchParams.set('end_date', params.end_date)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const query = searchParams.toString()
    return fetchAPI(`/api/readings${query ? `?${query}` : ''}`)
  },

  create: (reading: ReadingCreate): Promise<ReadingResponse> =>
    fetchAPI('/api/readings', {
      method: 'POST',
      body: JSON.stringify(reading),
    }),

  createBulk: (readings: ReadingCreate[]): Promise<ReadingResponse[]> =>
    fetchAPI('/api/readings/bulk', {
      method: 'POST',
      body: JSON.stringify(readings),
    }),

  delete: (id: string): Promise<{ message: string }> =>
    fetchAPI(`/api/readings/${id}`, {
      method: 'DELETE',
    }),

  update: (id: string, reading: ReadingUpdate): Promise<ReadingResponse> =>
    fetchAPI(`/api/readings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(reading),
    }),

  deleteAll: (): Promise<{ message: string; deleted_count: number }> =>
    fetchAPI('/api/readings/all', { method: 'DELETE' }),
}

export const settingsAPI = {
  get: (): Promise<SettingsResponse> =>
    fetchAPI('/api/settings'),

  update: (settings: SettingsUpdate): Promise<SettingsResponse> =>
    fetchAPI('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),
}

export interface UsageResponse {
  daily_count: number
  daily_limit: number
  last_used: string | null
}

export const usageAPI = {
  get: (): Promise<UsageResponse> =>
    fetchAPI('/api/usage'),
}

export const statsAPI = {
  get: (): Promise<StatsResponse> =>
    fetchAPI('/api/stats'),

  getTrends: (period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<TrendsResponse> =>
    fetchAPI(`/api/stats/trends?period=${period}`),

  getRecords: (): Promise<RecordsResponse> =>
    fetchAPI('/api/stats/records'),
}

export interface EnrichResponse {
  enriched_count: number
  message: string
}

export const weatherAPI = {
  enrich: (): Promise<EnrichResponse> =>
    fetchAPI('/api/weather/enrich', {
      method: 'POST',
    }),
}

export const geocodingAPI = {
  // Geocoding is public (no auth required) - use direct fetch instead of fetchAPI
  search: async (query: string): Promise<GeoSearchResponse> => {
    const url = `${API_BASE_URL}/api/geocode/search?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `API error: ${response.statusText}`)
    }
    return response.json()
  },
}

// ============ Family Types ============

export interface Family {
  id: string
  name: string
  join_code: string
  owner_id: string
  member_count: number
  is_owner: boolean
  created_at: string
}

export interface FamilyMember {
  id: string
  user_id: string
  display_name: string | null
  email: string | null
  role: 'owner' | 'member'
  joined_at: string
  images_processed: number
}

export interface FamilyImage {
  id: string
  filename: string
  uploader_id: string
  uploader_name: string | null
  status: 'pending' | 'claimed' | 'processing' | 'processed' | 'error'
  claimed_by: string | null
  claimed_by_name: string | null
  processed_by: string | null
  processed_by_name: string | null
  readings_count: number
  file_size: number
  created_at: string
  claimed_at: string | null
  processed_at: string | null
}

export interface ImageListResponse {
  images: FamilyImage[]
  total: number
  pending_count: number
  claimed_count: number
  processed_count: number
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string | null
  images_processed: number
  readings_extracted: number
  contribution_percent: number
  last_activity: string | null
}

export interface FamilyStats {
  total_images: number
  pending_images: number
  processed_images: number
  total_readings_extracted: number
  member_count: number
}

export interface FamilyDashboard {
  stats: FamilyStats
  leaderboard: LeaderboardEntry[]
  recent_activity: {
    image_id: string
    filename: string
    processed_by: string
    processed_by_name: string | null
    readings_count: number
    processed_at: string | null
  }[]
}

export interface FamilyProcessResponse {
  readings: ExtractedReading[]
  provider: string
  message: string
  job_id: string
  image_id: string
}

// ============ Family API ============

export const familyAPI = {
  get: (): Promise<Family | null> =>
    fetchAPI('/api/family'),

  create: (name: string, password: string): Promise<Family> =>
    fetchAPI('/api/family', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    }),

  join: (joinCode: string, password: string): Promise<Family> =>
    fetchAPI('/api/family/join', {
      method: 'POST',
      body: JSON.stringify({ join_code: joinCode, password }),
    }),

  leave: (): Promise<{ message: string }> =>
    fetchAPI('/api/family/leave', { method: 'POST' }),

  getMembers: (): Promise<FamilyMember[]> =>
    fetchAPI('/api/family/members'),

  removeMember: (userId: string): Promise<{ message: string }> =>
    fetchAPI(`/api/family/members/${userId}`, { method: 'DELETE' }),

  updateDisplayName: (displayName: string): Promise<FamilyMember> =>
    fetchAPI('/api/family/display-name', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: displayName }),
    }),

  getLeaderboard: (): Promise<LeaderboardEntry[]> =>
    fetchAPI('/api/family/leaderboard'),

  getStats: (): Promise<FamilyStats> =>
    fetchAPI('/api/family/stats'),

  getDashboard: (): Promise<FamilyDashboard> =>
    fetchAPI('/api/family/dashboard'),
}

// ============ Family Images API ============

export const familyImagesAPI = {
  list: (status?: string): Promise<ImageListResponse> =>
    fetchAPI(`/api/family/images${status ? `?status_filter=${status}` : ''}`),

  uploadBulk: async (files: File[]): Promise<FamilyImage[]> => {
    const authHeaders = await getAuthHeaders()
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))

    const response = await fetch(`${API_BASE_URL}/api/family/images/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || 'Upload failed')
    }

    return response.json()
  },

  claim: (imageId: string): Promise<FamilyImage> =>
    fetchAPI(`/api/family/images/${imageId}/claim`, { method: 'POST' }),

  release: (imageId: string): Promise<{ message: string }> =>
    fetchAPI(`/api/family/images/${imageId}/release`, { method: 'POST' }),

  getDownloadUrl: (imageId: string): string =>
    `${API_BASE_URL}/api/family/images/${imageId}/download`,

  download: async (imageId: string): Promise<Blob> => {
    const authHeaders = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/api/family/images/${imageId}/download`, {
      headers: authHeaders,
    })
    if (!response.ok) {
      throw new Error('Failed to download image')
    }
    return response.blob()
  },

  process: (imageId: string): Promise<FamilyProcessResponse> =>
    fetchAPI(`/api/family/images/${imageId}/process`, { method: 'POST' }),

  delete: (imageId: string): Promise<{ message: string }> =>
    fetchAPI(`/api/family/images/${imageId}`, { method: 'DELETE' }),
}
