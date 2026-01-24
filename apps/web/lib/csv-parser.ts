import Papa, { ParseResult as PapaParseResult } from 'papaparse'
import * as XLSX from 'xlsx'

// Extend global module declarations for packages
declare module 'papaparse'
declare module 'xlsx'

export interface ParsedRow {
  date: string | null
  time: string | null
  m1: number | null
  m2: number | null
}

export interface ParsedReading extends ParsedRow {
  rowIndex: number
  isValid: boolean
  errors: string[]
}

export interface ParseResult {
  readings: ParsedReading[]
  headers: string[]
  totalRows: number
  validRows: number
  invalidRows: number
}

// Column name variations for flexible matching
const COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ['date', 'reading date', 'reading_date', 'readingdate', 'datum'],
  time: ['time', 'reading time', 'reading_time', 'readingtime', 'zeit'],
  m1: ['m1', 'm1 (kwh)', 'm1(kwh)', 'meter 1', 'meter1', 'meter_1', 'm1_kwh', 'm1 kwh'],
  m2: ['m2', 'm2 (kwh)', 'm2(kwh)', 'meter 2', 'meter2', 'meter_2', 'm2_kwh', 'm2 kwh'],
}

// Columns to ignore (calculated values)
const IGNORE_COLUMNS = [
  'm1 daily', 'm1_daily', 'm1daily',
  'm2 daily', 'm2_daily', 'm2daily',
  'total daily', 'total_daily', 'totaldaily',
  'daily production', 'daily_production',
]

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim()
}

function findColumnMapping(header: string): string | null {
  const normalized = normalizeHeader(header)

  // Check if this is a column to ignore
  if (IGNORE_COLUMNS.some(col => normalized.includes(col))) {
    return null
  }

  for (const [field, variations] of Object.entries(COLUMN_MAPPINGS)) {
    if (variations.some(v => normalized === v || normalized.includes(v))) {
      return field
    }
  }
  return null
}

function parseDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null

  const str = String(value).trim()
  if (!str) return null

  // Try parsing as ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  // Try parsing as DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Try parsing as MM/DD/YYYY
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch
    // Assume MM/DD/YYYY format if month <= 12 and day > 12
    if (parseInt(month) <= 12 && parseInt(day) > 12) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }

  // Try parsing as Excel serial date number
  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(str)) {
    const serial = typeof value === 'number' ? value : parseFloat(str)
    if (serial > 1 && serial < 100000) {
      // Excel date: days since 1899-12-30
      const date = new Date((serial - 25569) * 86400 * 1000)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    }
  }

  // Try parsing any other date format
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  return null
}

function parseTime(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null

  const str = String(value).trim()
  if (!str) return null

  // Try parsing as HH:MM or HH:MM:SS
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (timeMatch) {
    const [, hours, minutes] = timeMatch
    return `${hours.padStart(2, '0')}:${minutes}`
  }

  // Excel time (fraction of day)
  if (typeof value === 'number' || /^0?\.\d+$/.test(str)) {
    const fraction = typeof value === 'number' ? value : parseFloat(str)
    if (fraction >= 0 && fraction < 1) {
      const totalMinutes = Math.round(fraction * 24 * 60)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
  }

  return null
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }

  const str = String(value).trim()
  if (!str) return null

  // Remove thousand separators and normalize decimal separator
  const normalized = str.replace(/,(?=\d{3})/g, '').replace(',', '.')
  const num = parseFloat(normalized)

  return isNaN(num) ? null : num
}

function validateReading(row: ParsedRow, rowIndex: number): ParsedReading {
  const errors: string[] = []

  // Validate date
  if (!row.date) {
    errors.push('Date is required')
  } else {
    // Check if it's a valid date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(row.date)) {
      errors.push('Invalid date format')
    }
  }

  // Validate m1
  if (row.m1 === null) {
    errors.push('M1 value is required')
  } else if (row.m1 < 0) {
    errors.push('M1 must be >= 0')
  }

  // Validate m2 if present
  if (row.m2 !== null && row.m2 < 0) {
    errors.push('M2 must be >= 0')
  }

  // Validate time if present
  if (row.time !== null) {
    const timeRegex = /^\d{2}:\d{2}$/
    if (!timeRegex.test(row.time)) {
      errors.push('Invalid time format')
    }
  }

  return {
    ...row,
    rowIndex,
    isValid: errors.length === 0,
    errors,
  }
}

export function mapColumnsToReadings(
  rows: Record<string, unknown>[],
  headers: string[]
): ParsedReading[] {
  // Build column mapping
  const columnMap: Record<string, string> = {}
  for (const header of headers) {
    const mapping = findColumnMapping(header)
    if (mapping) {
      columnMap[header] = mapping
    }
  }

  // Map rows to readings
  const readings: ParsedReading[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const parsedRow: ParsedRow = {
      date: null,
      time: null,
      m1: null,
      m2: null,
    }

    for (const [header, field] of Object.entries(columnMap)) {
      const value = row[header]

      switch (field) {
        case 'date':
          parsedRow.date = parseDate(value as string | number)
          break
        case 'time':
          parsedRow.time = parseTime(value as string | number)
          break
        case 'm1':
          parsedRow.m1 = parseNumber(value as string | number)
          break
        case 'm2':
          parsedRow.m2 = parseNumber(value as string | number)
          break
      }
    }

    // Skip completely empty rows
    if (parsedRow.date === null && parsedRow.m1 === null && parsedRow.m2 === null) {
      continue
    }

    readings.push(validateReading(parsedRow, i + 1)) // 1-indexed for user display
  }

  return readings
}

export async function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: PapaParseResult<Record<string, unknown>>) => {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, unknown>[]
        const readings = mapColumnsToReadings(rows, headers)

        resolve({
          readings,
          headers,
          totalRows: readings.length,
          validRows: readings.filter(r => r.isValid).length,
          invalidRows: readings.filter(r => !r.isValid).length,
        })
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // Use first sheet
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          reject(new Error('Excel file has no sheets'))
          return
        }

        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true })

        // Get headers from first row keys
        const headers = jsonData.length > 0 ? Object.keys(jsonData[0] as Record<string, unknown>) : []
        const readings = mapColumnsToReadings(jsonData as Record<string, unknown>[], headers)

        resolve({
          readings,
          headers,
          totalRows: readings.length,
          validRows: readings.filter(r => r.isValid).length,
          invalidRows: readings.filter(r => !r.isValid).length,
        })
      } catch (err) {
        reject(new Error(`Excel parsing error: ${err instanceof Error ? err.message : 'Unknown error'}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

export async function parseFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'csv') {
    return parseCSVFile(file)
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file)
  } else {
    throw new Error(`Unsupported file type: ${extension}. Please use CSV, XLSX, or XLS files.`)
  }
}
