import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// POST /api/destinations/test
router.post('/test', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, host, port, database, username, password } = req.body

  if (!type || !host || !port || !database || !username) {
    res.status(400).json({ error: 'Missing required connection fields' })
    return
  }

  try {
    if (type === 'postgresql') {
      const { Pool } = await import('pg')
      const pool = new Pool({ host, port, database, user: username, password, max: 1, timeout: 5000 })
      const client = await pool.connect()
      try {
        await client.query('SELECT 1')
      } finally {
        client.release()
        await pool.end()
      }
      res.json({ success: true, message: `Connected to PostgreSQL ${host}:${port}/${database}` })
    } else if (type === 'mysql') {
      const mysql = await import('mysql2/promise')
      const connection = await mysql.createConnection({
        host,
        port,
        database,
        user: username,
        password,
        connectTimeout: 5000,
      })
      try {
        await connection.query('SELECT 1')
      } finally {
        await connection.end()
      }
      res.json({ success: true, message: `Connected to MySQL ${host}:${port}/${database}` })
    } else {
      res.status(400).json({ error: 'Invalid database type' })
    }
  } catch (err: unknown) {
    console.error('[Destination Test Error]', err)
    res.status(500).json({ error: (err as Error)?.message ?? 'Connection failed' })
  }
})

export default router
