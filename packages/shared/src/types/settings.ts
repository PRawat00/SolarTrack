export interface UserSettings {
  id: string;
  user_id: string;
  currency_symbol: string;
  cost_per_kwh: number;
  co2_factor: number;
  yearly_goal: number;
  theme: 'light' | 'dark';
  created_at: string;
  updated_at: string;
}

export interface UpdateSettingsInput {
  currency_symbol?: string;
  cost_per_kwh?: number;
  co2_factor?: number;
  yearly_goal?: number;
  theme?: 'light' | 'dark';
}
