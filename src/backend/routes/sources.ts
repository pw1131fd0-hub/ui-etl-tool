import { Router, Response } from 'express'
import axios from 'axios'
import { parse } from 'csv-parse/sync'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Extract nested value using dot notation: "users[*].profile.name"
function extractDataPath(data: unknown, responsePath: string): unknown {
  if (!responsePath) return data
  const paths = responsePath.split('.').filter(Boolean)
  for (const p of paths) {
    if (p.includes('[*]')) {
      const key = p.replace('[*]', '')
      if (Array.isArray(data)) {
        // Collect items from all array elements
        const result: unknown[] = []
        for (const item of data) {
          if (key && typeof item === 'object' && item !== null) {
            const val = (item as Record<string, unknown>)[key]
            if (Array.isArray(val)) result.push(...val)
            else if (val !== undefined) result.push(val)
          }
        }
        data = result
      } else if (key && typeof data === 'object' && data !== null) {
        data = (data as Record<string, unknown>)[key]
      }
    } else {
      if (Array.isArray(data)) {
        // Apply path to each element and flatten
        const result: unknown[] = []
        for (const item of data) {
          if (typeof item === 'object' && item !== null) {
            const val = (item as Record<string, unknown>)[p]
            if (Array.isArray(val)) result.push(...val)
            else if (val !== undefined) result.push(val)
          }
        }
        data = result
      } else if (typeof data === 'object' && data !== null) {
        data = (data as Record<string, unknown>)?.[p]
      }
    }
  }
  return data
}

// Flatten nested objects: { user: { name: "John" } } -> { "user.name": "John" }
export function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (typeof obj !== 'object' || obj === null) {
    if (prefix) result[prefix] = obj
    return result
  }
  if (Array.isArray(obj)) {
    if (prefix) result[prefix] = obj
    return result
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else if (Array.isArray(value)) {
      // For arrays, store as JSON string or index-based fields
      result[newKey] = value
    } else {
      result[newKey] = value
    }
  }
  return result
}

// Expand flattened fields back to nested objects for writing
export function unflattenObject(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    let current = result
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) current[part] = {}
      current = current[part] as Record<string, unknown>
    }
    current[parts[parts.length - 1]] = value
  }
  return result
}

function normalizeToArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && data !== null) return [data as Record<string, unknown>]
  return []
}

// POST /api/sources/test
router.post('/test', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, url, method, headers, params, responsePath, csvData, jsonData } = req.body

  try {
    if (type === 'api' || type === 'json') {
      if (!url && !jsonData) {
        res.status(400).json({ error: 'URL or JSON data is required' })
        return
      }
      let responseData: unknown
      if (url) {
        const response = await axios({
          url,
          method: method ?? 'GET',
          headers: headers ?? {},
          params: params ?? {},
          timeout: 15000,
        })
        responseData = response.data
      } else if (jsonData) {
        try {
          responseData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
        } catch {
          res.status(400).json({ error: 'Invalid JSON data' })
          return
        }
      } else {
        res.status(400).json({ error: 'No data source provided' })
        return
      }

      let data = extractDataPath(responseData, responsePath ?? '')
      data = normalizeToArray(data)

      // Apply flattening to each row to expose nested fields as flat dot-notation keys
      const flatData = (data as Record<string, unknown>[]).map(row => flattenObject(row))
      const preview = flatData.slice(0, 5)

      // Collect all unique flattened field names across all rows (for preview headers)
      const fieldSet = new Set<string>()
      for (const row of flatData) {
        for (const key of Object.keys(row)) {
          fieldSet.add(key)
        }
      }
      const fields = Array.from(fieldSet).sort()

      // Build preview rows with all flattened fields
      res.json({
        rows: preview.map((r: Record<string, unknown>) =>
          fields.map((f) => {
            const val = r[f]
            if (val === null || val === undefined) return ''
            if (typeof val === 'object') return JSON.stringify(val)
            return String(val)
          })
        ),
        fields,
        hasNested: flatData.some(r => Object.keys(r).some(k => k.includes('.')))
      })
    } else if (type === 'csv') {
      if (!csvData) {
        res.status(400).json({ error: 'CSV data is required' })
        return
      }
      const records: Record<string, unknown>[] = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
      const preview = records.slice(0, 5)
      const fields = preview.length > 0 ? Object.keys(preview[0]) : []
      res.json({ rows: preview.map((r) => fields.map((f) => String(r[f] ?? ''))), fields })
    } else {
      res.status(400).json({ error: 'Invalid source type' })
    }
  } catch (err: unknown) {
    console.error('[Source Test Error]', err)
    res.status(500).json({ error: (err as Error)?.message ?? 'Failed to fetch source' })
  }
})

export default router
