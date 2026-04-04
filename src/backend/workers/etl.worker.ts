import axios from 'axios'
import { parse } from 'csv-parse/sync'
import { PrismaClient } from '@prisma/client'
import pg from 'pg'
import mysql from 'mysql2/promise'

const { Pool: PgPool } = pg
const prisma = new PrismaClient()

interface FieldMapping {
  id: string
  sourceField: string
  destField: string
  transform: 'string' | 'integer' | 'date' | 'trim' | 'lowercase'
}

interface SourceConfig {
  type: 'api' | 'csv'
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, string>
  responsePath?: string
  csvData?: string
}

interface DestinationConfig {
  type: 'postgresql' | 'mysql'
  host: string
  port: number
  database: string
  username: string
  password: string
  table: string
  writeMode: 'INSERT' | 'UPSERT'
}

interface ETLJob {
  pipelineId: string
  runId: string
  sourceConfig: SourceConfig
  transformConfig: { mappings: FieldMapping[] }
  destinationConfig: DestinationConfig
}

// --- Fetch Source ---
async function fetchSource(config: SourceConfig): Promise<Record<string, unknown>[]> {
  if (config.type === 'api') {
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
    if (!config.csvData) throw new Error('No CSV data provided')
    const records: Record<string, unknown>[] = parse(config.csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
    return records
  }
  throw new Error('Unknown source type')
}

// --- Transform ---
function applyTransform(value: unknown, type: string): unknown {
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
    case 'string':
    default:
      return String(value)
  }
}

function transformRow(
  row: Record<string, unknown>,
  mappings: FieldMapping[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const m of mappings) {
    const val = applyTransform(row[m.sourceField], m.transform)
    out[m.destField] = val
  }
  return out
}

// --- Write Destination ---
async function writeDestination(
  rows: Record<string, unknown>[],
  config: DestinationConfig,
  mappings: FieldMapping[]
): Promise<number> {
  if (rows.length === 0) return 0

  const destFields = mappings.map((m) => m.destField)
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

  try {
    // Fetch
    const rawData = await fetchSource(sourceConfig)
    inputRows = rawData.length

    // Transform
    const transformed = rawData.map((row) => transformRow(row, mappings))
    outputRows = transformed.length

    // Write
    const written = await writeDestination(transformed, destinationConfig, mappings)
    outputRows = written

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
