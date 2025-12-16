export interface SolarReading {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  value: number;
  unit: string; // kWh
  notes?: string;
  source_image_id?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSolarReadingInput {
  date: string;
  value: number;
  unit?: string;
  notes?: string;
  is_verified?: boolean;
}

export interface UpdateSolarReadingInput {
  date?: string;
  value?: number;
  unit?: string;
  notes?: string;
  is_verified?: boolean;
}

export interface SolarReadingsResponse {
  data: SolarReading[];
  total: number;
  limit: number;
  offset: number;
}
