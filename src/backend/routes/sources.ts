import { Router, Response } from 'express'
import axios from 'axios'
import { parse } from 'csv-parse/sync'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// POST /api/sources/test
router.post('/test', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, url, method, headers, params, responsePath, csvData } = req.body

  try {
    if (type === 'api') {
      if (!url) {
        res.status(400).json({ error: 'URL is required for API source' })
        return
      }
      const response = await axios({
        url,
        method: method ?? 'GET',
        headers: headers ?? {},
        params: params ?? {},
        timeout: 15000,
      })
      let data = response.data
      if (responsePath) {
        const paths = responsePath.split('.').filter(Boolean)
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
      const preview = data.slice(0, 5)
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
