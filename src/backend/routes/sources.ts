import { Router, Response } from 'express'
import axios from 'axios'
import { parse } from 'csv-parse/sync'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

function extractDataPath(data: unknown, responsePath: string): unknown {
  if (!responsePath) return data
  const paths = responsePath.split('.').filter(Boolean)
  for (const p of paths) {
    if (p.includes('[*]')) {
      const key = p.replace('[*]', '')
      data = (data as Record<string, unknown>)?.[key] ?? []
    } else {
      data = (data as Record<string, unknown>)?.[p]
    }
  }
  return data
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

      const preview = (data as Record<string, unknown>[]).slice(0, 5)
      const fields = preview.length > 0 ? Object.keys(preview[0]) : []
      res.json({ rows: preview.map((r: Record<string, unknown>) => fields.map((f) => String(r[f] ?? ''))), fields })
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
