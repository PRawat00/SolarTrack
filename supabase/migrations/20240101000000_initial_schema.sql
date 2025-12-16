-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Settings Table
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_symbol VARCHAR(5) DEFAULT '$',
  cost_per_kwh DECIMAL(10, 4) DEFAULT 0.15,
  co2_factor DECIMAL(10, 4) DEFAULT 0.85,
  yearly_goal DECIMAL(10, 2) DEFAULT 12000.00,
  theme VARCHAR(10) DEFAULT 'dark',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Solar Readings Table
CREATE TABLE solar_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(10) DEFAULT 'kWh',
  notes TEXT,
  source_image_id UUID REFERENCES images(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Images Table
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  size_bytes INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Processing Jobs Table
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_readings_user_date ON solar_readings(user_id, date DESC);
CREATE INDEX idx_readings_user_created ON solar_readings(user_id, created_at DESC);
CREATE INDEX idx_readings_source_image ON solar_readings(source_image_id);
CREATE INDEX idx_images_user_status ON images(user_id, status);
CREATE INDEX idx_processing_jobs_user_status ON processing_jobs(user_id, status);

-- Enable Row-Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Row-Level Security Policies for user_settings
CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Row-Level Security Policies for solar_readings
CREATE POLICY "Users can view their own readings"
  ON solar_readings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own readings"
  ON solar_readings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own readings"
  ON solar_readings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own readings"
  ON solar_readings FOR DELETE
  USING (auth.uid() = user_id);

-- Row-Level Security Policies for images
CREATE POLICY "Users can view their own images"
  ON images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own images"
  ON images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own images"
  ON images FOR DELETE
  USING (auth.uid() = user_id);

-- Row-Level Security Policies for processing_jobs
CREATE POLICY "Users can view their own jobs"
  ON processing_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON processing_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solar_readings_updated_at
  BEFORE UPDATE ON solar_readings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
