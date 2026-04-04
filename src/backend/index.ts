import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Queue from 'bull'
import authRouter from './routes/auth.js'
import pipelinesRouter from './routes/pipelines.js'
import runsRouter from './routes/runs.js'
import sourcesRouter from './routes/sources.js'
import destinationsRouter from './routes/destinations.js'
import { startETLWorker } from './workers/etl.worker.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/pipelines', pipelinesRouter)
app.use('/api', runsRouter)
app.use('/api/sources', sourcesRouter)
app.use('/api/destinations', destinationsRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// --- Bull ETL Queue ---
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const etlQueue = new Queue('etl', REDIS_URL)

// Expose queue for triggering runs
app.set('etlQueue', etlQueue)

// Start ETL worker
startETLWorker(etlQueue).catch((err) => {
  console.error('[ETL Worker] Failed to start:', err)
})

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  console.log(`[ETL Queue] Connected to ${REDIS_URL}`)
})
