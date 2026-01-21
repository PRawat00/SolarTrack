-- Oracle Migration: Add daily production columns to solar_readings
-- These columns store pre-calculated daily production values for faster queries and export

-- Add daily production columns (using NUMBER for Oracle instead of DECIMAL)
ALTER TABLE solar_readings
ADD (
    m1_daily NUMBER(10, 2),
    m2_daily NUMBER(10, 2),
    total_daily NUMBER(10, 2)
);

-- Add index for efficient queries on daily values
CREATE INDEX idx_readings_daily_production ON solar_readings(user_id, reading_date DESC, total_daily);

-- Add comments for documentation
COMMENT ON COLUMN solar_readings.m1_daily IS 'Daily production for meter 1 (calculated from difference with previous day)';
COMMENT ON COLUMN solar_readings.m2_daily IS 'Daily production for meter 2 (calculated from difference with previous day)';
COMMENT ON COLUMN solar_readings.total_daily IS 'Total daily production (m1_daily + m2_daily)';

-- Commit the changes
COMMIT;
