'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { parseFile, type ParsedReading, type ParseResult } from '@/lib/csv-parser'
import { readingsAPI, type ReadingCreate } from '@/lib/api/client'

type ImportStatus =
  | 'idle'
  | 'parsing'
  | 'preview'
  | 'importing'
  | 'complete'
  | 'error'

type DuplicateStrategy = 'skip' | 'overwrite' | 'import_all'

interface ImportState {
  status: ImportStatus
  error: string | null
  parseResult: ParseResult | null
  duplicateDates: Set<string>
  selectedReadings: Set<number>
  duplicateStrategy: DuplicateStrategy
  importProgress: { current: number; total: number }
  importResult: { imported: number; skipped: number; errors: number } | null
}

interface CSVImportPanelProps {
  onComplete: () => void
  onCancel: () => void
}

const BATCH_SIZE = 100

export function CSVImportPanel({ onComplete, onCancel }: CSVImportPanelProps) {
  const [state, setState] = useState<ImportState>({
    status: 'idle',
    error: null,
    parseResult: null,
    duplicateDates: new Set(),
    selectedReadings: new Set(),
    duplicateStrategy: 'skip',
    importProgress: { current: 0, total: 0 },
    importResult: null,
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setState(s => ({ ...s, status: 'parsing', error: null }))

    try {
      const result = await parseFile(file)

      if (result.readings.length === 0) {
        setState(s => ({
          ...s,
          status: 'error',
          error: 'No readings found in file. Please check the file format and column names.',
        }))
        return
      }

      // Check for duplicates against existing data
      const validDates = result.readings
        .filter(r => r.isValid && r.date)
        .map(r => r.date as string)

      let duplicateDates = new Set<string>()
      if (validDates.length > 0) {
        try {
          const response = await readingsAPI.checkDuplicates(validDates)
          duplicateDates = new Set(response.existing_dates)
        } catch {
          // If check fails, continue without duplicate info
          console.error('Failed to check duplicates')
        }
      }

      // Select all valid readings by default
      const selectedReadings = new Set(
        result.readings
          .filter(r => r.isValid)
          .map(r => r.rowIndex)
      )

      setState(s => ({
        ...s,
        status: 'preview',
        parseResult: result,
        duplicateDates,
        selectedReadings,
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to parse file',
      }))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: state.status !== 'idle',
    onDragEnter: undefined,
    onDragLeave: undefined,
    onDragOver: undefined,
    multiple: false,
  })

  const toggleReading = (rowIndex: number) => {
    setState(s => {
      const newSelected = new Set(s.selectedReadings)
      if (newSelected.has(rowIndex)) {
        newSelected.delete(rowIndex)
      } else {
        newSelected.add(rowIndex)
      }
      return { ...s, selectedReadings: newSelected }
    })
  }

  const selectAll = () => {
    if (!state.parseResult) return
    const allValid = new Set(
      state.parseResult.readings
        .filter(r => r.isValid)
        .map(r => r.rowIndex)
    )
    setState(s => ({ ...s, selectedReadings: allValid }))
  }

  const selectNone = () => {
    setState(s => ({ ...s, selectedReadings: new Set() }))
  }

  const handleImport = async () => {
    if (!state.parseResult) return

    const readingsToImport = state.parseResult.readings.filter(r =>
      r.isValid && state.selectedReadings.has(r.rowIndex)
    )

    if (readingsToImport.length === 0) {
      setState(s => ({ ...s, error: 'No readings selected for import' }))
      return
    }

    // Filter based on duplicate strategy
    let finalReadings: ParsedReading[]
    if (state.duplicateStrategy === 'skip') {
      finalReadings = readingsToImport.filter(r => !state.duplicateDates.has(r.date!))
    } else {
      finalReadings = readingsToImport
    }

    if (finalReadings.length === 0) {
      setState(s => ({
        ...s,
        status: 'complete',
        importResult: { imported: 0, skipped: readingsToImport.length, errors: 0 },
      }))
      return
    }

    setState(s => ({
      ...s,
      status: 'importing',
      importProgress: { current: 0, total: finalReadings.length },
      error: null,
    }))

    let imported = 0
    let errors = 0
    const useOverwrite = state.duplicateStrategy === 'overwrite'

    // Batch import
    for (let i = 0; i < finalReadings.length; i += BATCH_SIZE) {
      const batch = finalReadings.slice(i, i + BATCH_SIZE)
      const readings: ReadingCreate[] = batch.map(r => ({
        date: r.date!,
        time: r.time || undefined,
        m1: r.m1!,
        m2: r.m2 || undefined,
        is_verified: true,
      }))

      try {
        await readingsAPI.createBulk(readings, useOverwrite)
        imported += batch.length
      } catch (err) {
        console.error('Batch import error:', err)
        errors += batch.length
      }

      setState(s => ({
        ...s,
        importProgress: { current: i + batch.length, total: finalReadings.length },
      }))
    }

    const skipped = readingsToImport.length - finalReadings.length

    setState(s => ({
      ...s,
      status: 'complete',
      importResult: { imported, skipped, errors },
    }))

    // Auto-complete after delay
    setTimeout(() => {
      onComplete()
    }, 2000)
  }

  const resetImport = () => {
    setState({
      status: 'idle',
      error: null,
      parseResult: null,
      duplicateDates: new Set(),
      selectedReadings: new Set(),
      duplicateStrategy: 'skip',
      importProgress: { current: 0, total: 0 },
      importResult: null,
    })
  }

  const getSelectedCount = () => state.selectedReadings.size
  const getDuplicateCount = () => {
    if (!state.parseResult) return 0
    return state.parseResult.readings.filter(r =>
      r.isValid && state.selectedReadings.has(r.rowIndex) && state.duplicateDates.has(r.date!)
    ).length
  }

  return (
    <div className="space-y-4">
      {state.error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {/* Idle - Dropzone */}
      {state.status === 'idle' && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive
              ? 'border-orange-500 bg-orange-500/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
          `}
        >
          <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted p-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Import CSV or Excel</p>
              <p className="text-sm text-muted-foreground">
                Drag and drop your spreadsheet or click to browse.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: CSV, XLSX, XLS
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Parsing */}
      {state.status === 'parsing' && (
        <div className="text-center py-8 space-y-4">
          <div className="h-8 w-8 mx-auto rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="font-medium">Parsing file...</p>
        </div>
      )}

      {/* Preview */}
      {state.status === 'preview' && state.parseResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {state.parseResult.totalRows} rows found,{' '}
              <span className="text-green-600">{state.parseResult.validRows} valid</span>
              {state.parseResult.invalidRows > 0 && (
                <>, <span className="text-destructive">{state.parseResult.invalidRows} invalid</span></>
              )}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-6 text-xs">
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="h-6 text-xs">
                None
              </Button>
            </div>
          </div>

          {/* Duplicate handling */}
          {getDuplicateCount() > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                {getDuplicateCount()} readings have dates that already exist
              </p>
              <div className="flex gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="duplicate"
                    checked={state.duplicateStrategy === 'skip'}
                    onChange={() => setState(s => ({ ...s, duplicateStrategy: 'skip' }))}
                    className="accent-orange-500"
                  />
                  Skip duplicates
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="duplicate"
                    checked={state.duplicateStrategy === 'overwrite'}
                    onChange={() => setState(s => ({ ...s, duplicateStrategy: 'overwrite' }))}
                    className="accent-orange-500"
                  />
                  Overwrite existing
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="duplicate"
                    checked={state.duplicateStrategy === 'import_all'}
                    onChange={() => setState(s => ({ ...s, duplicateStrategy: 'import_all' }))}
                    className="accent-orange-500"
                  />
                  Import all
                </label>
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="border rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left w-12">#</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-right">M1</th>
                  <th className="p-2 text-right">M2</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.parseResult.readings.map((reading) => {
                  const isDuplicate = reading.date && state.duplicateDates.has(reading.date)
                  const isSelected = state.selectedReadings.has(reading.rowIndex)

                  return (
                    <tr
                      key={reading.rowIndex}
                      className={`border-t ${!reading.isValid ? 'bg-destructive/5' : isDuplicate ? 'bg-amber-500/5' : ''} ${!isSelected ? 'opacity-50' : ''}`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleReading(reading.rowIndex)}
                          disabled={!reading.isValid}
                          className="h-4 w-4 accent-orange-500"
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{reading.rowIndex}</td>
                      <td className="p-2 font-mono">{reading.date || '-'}</td>
                      <td className="p-2 font-mono">{reading.time || '-'}</td>
                      <td className="p-2 text-right font-mono">
                        {reading.m1 !== null ? reading.m1.toFixed(2) : '-'}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {reading.m2 !== null ? reading.m2.toFixed(2) : '-'}
                      </td>
                      <td className="p-2">
                        {!reading.isValid ? (
                          <span className="text-destructive text-xs" title={reading.errors.join(', ')}>
                            {reading.errors[0]}
                          </span>
                        ) : isDuplicate ? (
                          <span className="text-amber-600 text-xs">Duplicate</span>
                        ) : (
                          <span className="text-green-600 text-xs">OK</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleImport}
              disabled={getSelectedCount() === 0}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
            >
              Import {getSelectedCount()} Reading{getSelectedCount() !== 1 ? 's' : ''}
            </Button>
            <Button variant="outline" onClick={resetImport}>
              Choose Different File
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Importing */}
      {state.status === 'importing' && (
        <div className="text-center py-8 space-y-4">
          <div className="h-8 w-8 mx-auto rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="font-medium">Importing readings...</p>
          <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all"
              style={{
                width: `${(state.importProgress.current / state.importProgress.total) * 100}%`,
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {state.importProgress.current} of {state.importProgress.total}
          </p>
        </div>
      )}

      {/* Complete */}
      {state.status === 'complete' && state.importResult && (
        <div className="text-center py-8 space-y-3">
          <div className="text-green-500 text-4xl">&#10003;</div>
          <p className="font-medium text-green-500">Import Complete</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Imported: {state.importResult.imported}</p>
            {state.importResult.skipped > 0 && (
              <p>Skipped: {state.importResult.skipped}</p>
            )}
            {state.importResult.errors > 0 && (
              <p className="text-destructive">Errors: {state.importResult.errors}</p>
            )}
          </div>
        </div>
      )}

      {/* Error state with retry */}
      {state.status === 'error' && (
        <div className="text-center py-4">
          <Button variant="outline" onClick={resetImport}>
            Try Again
          </Button>
          <Button variant="ghost" onClick={onCancel} className="ml-2">
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
