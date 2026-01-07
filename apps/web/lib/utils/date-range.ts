/**
 * Date range utilities for generating continuous date series and filling data gaps.
 * Used by the production trend chart to display continuous lines across filtered date ranges.
 */

import type { TrendDataPoint } from '@/lib/api/client'

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

/**
 * Get ISO 8601 week information for a given date.
 * Week 1 is the week containing January 4.
 * Weeks start on Monday.
 */
export function getISOWeek(date: Date): { year: number; week: number } {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7 // Monday = 0
  target.setDate(target.getDate() - dayNr + 3) // Thursday of week
  const jan4 = new Date(target.getFullYear(), 0, 4)
  const dayDiff = (target.valueOf() - jan4.valueOf()) / 86400000
  const weekNr = 1 + Math.ceil(dayDiff / 7)
  return { year: target.getFullYear(), week: weekNr }
}

/**
 * Parse a period-specific date string to a Date object.
 * Handles:
 * - Daily: "2025-01-15" → January 15, 2025
 * - Weekly: "2025-W01" → First Monday of week 1
 * - Monthly: "2025-01" → January 1, 2025
 * - Yearly: "2025" → January 1, 2025
 */
export function parseDate(dateStr: string, period: Period): Date {
  if (period === 'daily') {
    return new Date(dateStr + 'T00:00:00Z')
  }

  if (period === 'weekly') {
    // DEFENSIVE: Check if backend sent daily format by mistake (backend bug)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.warn(`[BACKEND BUG] Backend returned daily format for weekly period: ${dateStr}`)
      return new Date(dateStr + 'T00:00:00Z')
    }

    // Parse "2025-W01" or "2025-W1" format (accepts 1 or 2 digit week numbers)
    const match = dateStr.match(/(\d{4})-W(\d{1,2})/)
    if (!match) throw new Error(`Invalid weekly date format: ${dateStr}`)

    const year = parseInt(match[1])
    const week = parseInt(match[2])

    // Calculate the Monday of the given ISO week
    const jan4 = new Date(Date.UTC(year, 0, 4))
    const dayOfWeek = jan4.getUTCDay() || 7
    const mondayOfWeek1 = new Date(jan4)
    mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1)
    const result = new Date(mondayOfWeek1)
    result.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7)

    return result
  }

  if (period === 'monthly') {
    // Parse "2025-01" format
    return new Date(dateStr + '-01T00:00:00Z')
  }

  if (period === 'yearly') {
    // Parse "2025" format
    return new Date(dateStr + '-01-01T00:00:00Z')
  }

  throw new Error(`Unknown period: ${period}`)
}

/**
 * Format a Date object to period-specific string format.
 * Matches backend format from stats.py:132-143
 */
export function formatDateForPeriod(date: Date, period: Period): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()

  if (period === 'daily') {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  if (period === 'weekly') {
    const { year: isoYear, week } = getISOWeek(date)
    return `${isoYear}-W${String(week).padStart(2, '0')}`
  }

  if (period === 'monthly') {
    return `${year}-${String(month).padStart(2, '0')}`
  }

  if (period === 'yearly') {
    return `${year}`
  }

  throw new Error(`Unknown period: ${period}`)
}

/**
 * Advance a date by N periods.
 * Handles month-end edge cases (e.g., Jan 31 + 1 month = Feb 28/29)
 */
export function addPeriod(date: Date, period: Period, count: number): Date {
  const result = new Date(date)

  if (period === 'daily') {
    result.setUTCDate(result.getUTCDate() + count)
  } else if (period === 'weekly') {
    result.setUTCDate(result.getUTCDate() + count * 7)
  } else if (period === 'monthly') {
    result.setUTCMonth(result.getUTCMonth() + count)
  } else if (period === 'yearly') {
    result.setUTCFullYear(result.getUTCFullYear() + count)
  }

  return result
}

/**
 * Generate a continuous series of date strings for the given range.
 * Returns dates in the correct format for the period type.
 */
export function generateDateSeries(
  start: Date,
  end: Date,
  period: Period
): string[] {
  const series: string[] = []
  let current = new Date(start)

  if (period === 'daily') {
    while (current <= end) {
      series.push(formatDateForPeriod(current, 'daily'))
      current.setUTCDate(current.getUTCDate() + 1)
    }
  } else if (period === 'weekly') {
    // Align start to the Monday of its week
    const dayOfWeek = current.getUTCDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    current.setUTCDate(current.getUTCDate() + diff)

    while (current <= end) {
      series.push(formatDateForPeriod(current, 'weekly'))
      current.setUTCDate(current.getUTCDate() + 7)
    }
  } else if (period === 'monthly') {
    // Set to first day of month
    current.setUTCDate(1)

    while (current <= end) {
      series.push(formatDateForPeriod(current, 'monthly'))
      current.setUTCMonth(current.getUTCMonth() + 1)
    }
  } else if (period === 'yearly') {
    // Set to Jan 1
    current.setUTCMonth(0)
    current.setUTCDate(1)

    while (current <= end) {
      series.push(formatDateForPeriod(current, 'yearly'))
      current.setUTCFullYear(current.getUTCFullYear() + 1)
    }
  }

  return series
}

/**
 * Fill data gaps with zero-filled data points.
 * Creates a continuous series for the date range and maps existing data to it.
 * Uses Map for O(1) lookups when building the result.
 *
 * @param data - Array of data points from API (dates in period-specific format)
 * @param period - Current period (daily/weekly/monthly/yearly)
 * @param startDate - Filter start date in DAILY format (YYYY-MM-DD from HTML5 input)
 * @param endDate - Filter end date in DAILY format (YYYY-MM-DD from HTML5 input)
 * @returns Array with gaps filled, guaranteed one point per date in range
 */
export function fillDataGaps(
  data: TrendDataPoint[],
  period: Period,
  startDate?: string,
  endDate?: string
): TrendDataPoint[] {
  // Handle empty data
  if (data.length === 0) {
    if (!startDate || !endDate) {
      return []
    }
    // If filters are set but no data, fill entire range with zeros
    // Filter dates are ALWAYS in daily format (YYYY-MM-DD) from HTML5 input
    const rangeStart = new Date(startDate + 'T00:00:00Z')
    const rangeEnd = new Date(endDate + 'T00:00:00Z')
    const series = generateDateSeries(rangeStart, rangeEnd, period)
    return series.map(date => ({
      date,
      m1: 0,
      m2: 0,
      radiation: 0,
      snowfall: 0,
      total: 0,
    }))
  }

  // Create Map for O(1) lookups (date → data point)
  const dataMap = new Map<string, TrendDataPoint>()
  data.forEach(point => {
    dataMap.set(point.date, point)
  })

  // Determine date range
  let rangeStart: Date
  let rangeEnd: Date

  if (startDate && endDate) {
    // Filter dates are ALWAYS in daily format (YYYY-MM-DD) from HTML5 input
    rangeStart = new Date(startDate + 'T00:00:00Z')
    rangeEnd = new Date(endDate + 'T00:00:00Z')
  } else {
    // Use first and last dates from data (period-specific format)
    const dates = Array.from(dataMap.keys()).sort()
    try {
      rangeStart = parseDate(dates[0], period)
      rangeEnd = parseDate(dates[dates.length - 1], period)
    } catch (error) {
      console.error('Failed to parse data dates:', { firstDate: dates[0], lastDate: dates[dates.length - 1], period, error })
      // Return empty array instead of crashing - gracefully degrade
      return []
    }
  }

  // Generate complete date series for range
  const completeSeries = generateDateSeries(rangeStart, rangeEnd, period)

  // Build result with gaps filled
  const result: TrendDataPoint[] = []

  for (const dateKey of completeSeries) {
    if (dataMap.has(dateKey)) {
      // Use existing data point (preserves actual values)
      result.push(dataMap.get(dateKey)!)
    } else {
      // Create zero-filled point for missing date
      result.push({
        date: dateKey,
        m1: 0,
        m2: 0,
        radiation: 0,
        snowfall: 0,
        total: 0,
      })
    }
  }

  return result
}
