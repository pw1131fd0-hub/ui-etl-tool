import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Queue, { Queue as QueueType } from 'bull'
import authRouter from './routes/auth.js'
import pipelinesRouter from './routes/pipelines.js'
import runsRouter from './routes/runs.js'
import sourcesRouter from './routes/sources.js'
import destinationsRouter from './routes/destinations.js'
import apiKeysRouter from './routes/apikeys.js'
import templatesRouter from './routes/templates.js'
import activityRouter from './routes/activity.js'
import exportRouter from './routes/export.js'
import { startETLWorker } from './workers/etl.worker.js'
import { initScheduler } from './scheduler.js'

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
app.use('/api/apikeys', apiKeysRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/activity', activityRouter)
app.use('/api/export', exportRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// --- Bull ETL Queue ---
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const etlQueue = new Queue<{
  pipelineId: string
  runId: string
  sourceConfig: Record<string, unknown>
  transformConfig: Record<string, unknown>
  destinationConfig: Record<string, unknown>
}>('etl', REDIS_URL)

app.set('etlQueue', etlQueue)

// --- SSE for real-time run progress ---
const runSubscribers = new Map<string, express.Response[]>()

export function emitRunProgress(runId: string, data: object) {
  const subscribers = runSubscribers.get(runId)
  if (subscribers) {
    const message = `data: ${JSON.stringify(data)}\n\n`
    subscribers.forEach((res) => res.write(message))
  }
}

app.get('/api/runs/:id/stream', (req, res) => {
  const runId = req.params.id
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  if (!runSubscribers.has(runId)) {
    runSubscribers.set(runId, [])
  }
  runSubscribers.get(runId)!.push(res)

  // Send initial heartbeat
  res.write('data: {"type":"connected"}\n\n')

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write('data: {"type":"heartbeat"}\n\n')
  }, 30000)

  req.on('close', () => {
    clearInterval(heartbeat)
    const subs = runSubscribers.get(runId)
    if (subs) {
      const idx = subs.indexOf(res)
      if (idx >= 0) subs.splice(idx, 1)
    }
  })
})

// --- Start ETL Worker ---
startETLWorker(etlQueue).catch((err) => {
  console.error('[ETL Worker] Failed to start:', err)
})

// --- Start Scheduler ---
initScheduler(etlQueue).catch((err) => {
  console.error('[Scheduler] Failed to init:', err)
})

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  console.log(`[ETL Queue] Connected to ${REDIS_URL}`)
})
