import axios from 'axios'
import { parse } from 'csv-parse/sync'
import { PrismaClient } from '@prisma/client'
import pg from 'pg'
import mysql from 'mysql2/promise'
import * as fs from 'fs'
import * as path from 'path'
import { emitRunProgress } from '../index.js'
import { flattenObject, flattenRows, getNestedValue } from '../utils/transform.js'

const { Pool: PgPool } = pg
const prisma = new PrismaClient()

interface FieldMapping {
  id: string
  sourceField: string
  destField: string
  transform: 'string' | 'integer' | 'date' | 'trim' | 'lowercase' | 'uppercase' | 'concat' | 'filter'
  transformParams?: Record<string, unknown>
}

interface TransformConfig {
  mappings: FieldMapping[]
  filterField?: string
  filterOperator?: string
  filterValue?: string
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  flattenNested?: boolean
}

interface SourceConfig {
  type: 'api' | 'csv' | 'json'
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, string>
  responsePath?: string
  csvData?: string
  jsonData?: string
}

interface DestinationConfig {
  type: 'postgresql' | 'mysql' | 'csv'
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  table?: string
  writeMode?: 'INSERT' | 'UPSERT'
  csvPath?: string
  csvDelimiter?: string
}

interface ETLJob {
  pipelineId: string
  runId: string
  sourceConfig: SourceConfig
  transformConfig: TransformConfig
  destinationConfig: DestinationConfig
}

// --- Fetch Source ---
async function fetchSource(config: SourceConfig): Promise<Record<string, unknown>[]> {
  if (config.type === 'api' || config.type === 'json') {
    const response = await axios({
      url: config.url,
      method: config.method ?? 'GET',
      headers: config.headers,
      params: config.params,
      timeout: 30000,
    })
    let data = response.data
    if (config.responsePath) {
      const paths = config.responsePath.split('.').filter(Boolean)
      for (const p of paths) {
        if (p.includes('[*]')) {
          const key = p.replace('[*]', '')
          data = data?.[key] ?? []
        } else {
          data = data?.[p]
        }
      }
    }
    if (!Array.isArray(data)) {
      data = [data]
    }
    return data as Record<string, unknown>[]
  } else if (config.type === 'csv') {
    let csvText: string
    if (config.url) {
      // Fetch CSV from URL
      const response = await axios.get(config.url, { timeout: 30000 })
      csvText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    } else if (config.csvData) {
      csvText = config.csvData
    } else {
      throw new Error('No CSV data or URL provided')
    }
    const records: Record<string, unknown>[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
    return records
  }
  throw new Error('Unknown source type')
}

// --- Fetch JSON data inline ---
async function fetchJsonInline(jsonData: string): Promise<Record<string, unknown>[]> {
  let data: unknown
  try {
    data = JSON.parse(jsonData)
  } catch {
    throw new Error('Invalid JSON data')
  }
  if (Array.isArray(data)) {
    return data
  }
  if (typeof data === 'object' && data !== null) {
    return [data as Record<string, unknown>]
  }
  throw new Error('JSON data must be an array or object')
}

// --- Transform ---
function applyTransform(value: unknown, type: string, params?: Record<string, unknown>): unknown {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'integer': {
      const num = parseInt(String(value), 10)
      return isNaN(num) ? null : num
    }
    case 'date': {
      const d = new Date(String(value))
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    case 'trim':
      return String(value).trim()
    case 'lowercase':
      return String(value).toLowerCase()
    case 'uppercase':
      return String(value).toUpperCase()
    case 'concat': {
      const prefix = (params?.prefix as string) ?? ''
      const suffix = (params?.suffix as string) ?? ''
      return prefix + String(value) + suffix
    }
    case 'string':
    default:
      return String(value)
  }
}

function transformRow(
  row: Record<string, unknown>,
  mappings: FieldMapping[]
): Record<string, unknown> {
  if (!mappings || mappings.length === 0) {
    // Pass through all fields as-is when no mappings defined
    return { ...row }
  }
  const out: Record<string, unknown> = {}
  for (const m of mappings) {
    if (m.transform === 'filter') continue
    // Support dot notation for nested fields: "user.profile.name"
    const val = m.sourceField.includes('.')
      ? getNestedValue(row, m.sourceField)
      : row[m.sourceField]
    out[m.destField] = applyTransform(val, m.transform, m.transformParams)
  }
  return out
}

function filterRows(
  rows: Record<string, unknown>[],
  filterField: string,
  filterOperator: string,
  filterValue: string
): Record<string, unknown>[] {
  if (!filterField) return rows
  return rows.filter((row) => {
    const fieldVal = String(row[filterField] ?? '')
    switch (filterOperator) {
      case 'eq':
        return fieldVal === filterValue
      case 'neq':
        return fieldVal !== filterValue
      case 'contains':
        return fieldVal.includes(filterValue)
      case 'gt':
        return parseFloat(fieldVal) > parseFloat(filterValue)
      case 'lt':
        return parseFloat(fieldVal) < parseFloat(filterValue)
      case 'gte':
        return parseFloat(fieldVal) >= parseFloat(filterValue)
      case 'lte':
        return parseFloat(fieldVal) <= parseFloat(filterValue)
      default:
        return true
    }
  })
}

function sortRows(
  rows: Record<string, unknown>[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Record<string, unknown>[] {
  if (!sortField) return rows
  return [...rows].sort((a, b) => {
    const aVal = String(a[sortField] ?? '')
    const bVal = String(b[sortField] ?? '')
    const cmp = aVal.localeCompare(bVal, undefined, { numeric: true })
    return sortDirection === 'desc' ? -cmp : cmp
  })
}

// --- Write Destination ---
async function writeDestination(
  rows: Record<string, unknown>[],
  config: DestinationConfig,
  mappings: FieldMapping[]
): Promise<number> {
  if (rows.length === 0) return 0

  // When mappings is empty, use the keys from the first row as destFields
  const destFields = (mappings.length > 0)
    ? mappings.map((m) => m.destField)
    : Object.keys(rows[0])

  // CSV Destination
  if (config.type === 'csv') {
    const csvPath = config.csvPath ?? './output.csv'
    const delimiter = config.csvDelimiter ?? ','
    const header = destFields.join(delimiter)
    const csvRows = rows.map((row) =>
      destFields.map((f) => {
        const val = row[f] ?? ''
        const valStr = String(val)
        // Escape quotes and wrap in quotes if contains delimiter or newline
        if (valStr.includes(delimiter) || valStr.includes('\n') || valStr.includes('"')) {
          return `"${valStr.replace(/"/g, '""')}"`
        }
        return valStr
      }).join(delimiter)
    )
    const csvContent = [header, ...csvRows].join('\n')
    // Ensure directory exists
    const dir = path.dirname(csvPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(csvPath, csvContent, 'utf-8')
    return rows.length
  }

  const placeholders = destFields.map((_, i) => `$${i + 1}`).join(', ')
  const insertCols = destFields.join(', ')
  const upsertCols = destFields.map((f) => `${f} = EXCLUDED.${f}`).join(', ')

  if (config.type === 'postgresql') {
    const pool = new PgPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 5,
    })
    const client = await pool.connect()
    try {
      const batchSize = 1000
      let total = 0
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const values: unknown[] = []
        for (const row of batch) {
          for (const f of destFields) {
            values.push(row[f] ?? null)
          }
        }
        const query =
          config.writeMode === 'UPSERT'
            ? `INSERT INTO ${config.table} (${insertCols}) VALUES (${placeholders}) ON CONFLICT DO UPDATE SET ${upsertCols}`
            : `INSERT INTO ${config.table} (${insertCols}) VALUES (${placeholders})`
        // Repeat placeholders for each row
        const rowsPerInsert = placeholders.split(',').length
        const multiRows: string[] = []
        const multiValues: unknown[] = []
        for (let r = 0; r < batch.length; r++) {
          multiRows.push(`(${destFields.map((_, c) => `$${r * destFields.length + c + 1}`).join(', ')})`)
          for (const f of destFields) {
            multiValues.push(batch[r][f] ?? null)
          }
        }
        const multiQuery =
          config.writeMode === 'UPSERT'
            ? `INSERT INTO ${config.table} (${insertCols}) VALUES ${multiRows.join(', ')} ON CONFLICT DO UPDATE SET ${upsertCols}`
            : `INSERT INTO ${config.table} (${insertCols}) VALUES ${multiRows.join(', ')}`
        await client.query(multiQuery, multiValues)
        total += batch.length
      }
      return total
    } finally {
      client.release()
      await pool.end()
    }
  } else if (config.type === 'mysql') {
    const pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      waitForConnections: true,
      connectionLimit: 5,
    })
    try {
      const batchSize = 1000
      let total = 0
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const multiRows: string[] = []
        const multiValues: unknown[] = []
        for (const row of batch) {
          const rowVals = destFields.map((f) => row[f] ?? null)
          multiRows.push('(' + rowVals.map(() => '?').join(', ') + ')')
          multiValues.push(...rowVals)
        }
        const query =
          config.writeMode === 'UPSERT'
            ? `INSERT INTO ${config.table} (${insertCols}) VALUES ${multiRows.join(', ')} AS new ON DUPLICATE KEY UPDATE ${destFields.map((f) => `${f}=new.${f}`).join(', ')}`
            : `INSERT INTO ${config.table} (${insertCols}) VALUES ${multiRows.join(', ')}`
        // MySQL REPLACE approach
        const replaceQuery = `REPLACE INTO ${config.table} (${insertCols}) VALUES ${multiRows.join(', ')}`
        await pool.query(replaceQuery, multiValues)
        total += batch.length
      }
      return total
    } finally {
      await pool.end()
    }
  }
  throw new Error('Unknown destination type')
}

// --- ETL Process ---
export async function processETLJob(job: ETLJob): Promise<{ inputRows: number; outputRows: number }> {
  const { pipelineId, runId, sourceConfig, transformConfig, destinationConfig } = job
  const mappings = transformConfig.mappings ?? []

  let inputRows = 0
  let outputRows = 0
  let errorMessage: string | undefined

  const emit = (stage: string, progress: number, details?: object) => {
    emitRunProgress(runId, { stage, progress, timestamp: new Date().toISOString(), ...details })
  }

  try {
    // Stage 1: Fetching
    emit('fetching', 10)
    const rawData = await fetchSource(sourceConfig)
    inputRows = rawData.length
    emit('fetching', 30, { rowsFetched: inputRows })

    // Stage 2: Flattening (for nested JSON)
    let transformed = rawData
    if (transformConfig.flattenNested) {
      emit('flattening', 35)
      transformed = flattenRows(transformed)
      emit('flattening', 40, { fieldsAfterFlatten: Object.keys(transformed[0] ?? {}).length })
    }

    // Stage 3: Filtering
    if (transformConfig.filterField) {
      emit('filtering', 45)
      transformed = filterRows(transformed, transformConfig.filterField, transformConfig.filterOperator ?? 'eq', transformConfig.filterValue ?? '')
      emit('filtering', 50, { rowsAfterFilter: transformed.length })
    }

    // Stage 4: Sorting
    if (transformConfig.sortField) {
      emit('sorting', 55)
      transformed = sortRows(transformed, transformConfig.sortField, transformConfig.sortDirection ?? 'asc')
      emit('sorting', 60)
    }

    // Stage 5: Transforming
    emit('transforming', 65)
    transformed = transformed.map((row) => transformRow(row, mappings))
    outputRows = transformed.length
    emit('transforming', 75, { rowsTransformed: outputRows })

    // Stage 5: Writing
    emit('writing', 80)
    const written = await writeDestination(transformed, destinationConfig, mappings)
    outputRows = written
    emit('writing', 95, { rowsWritten: outputRows })

    // Success
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'completed',
        inputRows,
        outputRows,
        completedAt: new Date(),
      },
    })
    emit('completed', 100, { inputRows, outputRows })
  } catch (err: unknown) {
    errorMessage = (err as Error)?.message ?? 'Unknown error'
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'failed',
        inputRows,
        outputRows,
        errorMessage,
        completedAt: new Date(),
      },
    })
    emit('failed', 100, { error: errorMessage })
    throw err
  }

  return { inputRows, outputRows }
}

// --- Bull Worker Entry ---
export async function startETLWorker(etlQueue: {
  process: (handler: (job: { data: ETLJob }) => Promise<void>) => void
}): Promise<void> {
  etlQueue.process(async (job) => {
    console.log(`[ETL Worker] Processing job for pipeline: ${job.data.pipelineId}`)
    await processETLJob(job.data)
    console.log(`[ETL Worker] Completed pipeline: ${job.data.pipelineId}`)
  })
}
