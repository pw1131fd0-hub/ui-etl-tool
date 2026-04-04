import { Router, Response } from 'express'
import Queue, { Queue as QueueType } from 'bull'
import { prisma } from '../config/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// GET /api/pipelines/:id/runs
router.get('/pipelines/:id/runs', async (req: AuthRequest, res: Response): Promise<void> => {
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })

  if (!pipeline) {
    res.status(404).json({ error: 'Pipeline not found' })
    return
  }

  const runs = await prisma.run.findMany({
    where: { pipelineId: req.params.id },
    orderBy: { startedAt: 'desc' },
    take: 100,
  })

  res.json(runs)
})

// POST /api/runs — trigger pipeline run
router.post('/runs', async (req: AuthRequest, res: Response): Promise<void> => {
  const { pipelineId } = req.body

  if (!pipelineId) {
    res.status(400).json({ error: 'pipelineId is required' })
    return
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, workspaceId: req.workspaceId },
  })

  if (!pipeline) {
    res.status(404).json({ error: 'Pipeline not found' })
    return
  }

  // Create Run record
  const run = await prisma.run.create({
    data: {
      pipelineId: pipeline.id,
      status: 'running',
    },
  })

  // Enqueue ETL job
  const etlQueue = req.app.get('etlQueue') as QueueType<{
    pipelineId: string
    runId: string
    sourceConfig: Record<string, unknown>
    transformConfig: Record<string, unknown>
    destinationConfig: Record<string, unknown>
  }>

  await etlQueue.add({
    pipelineId: pipeline.id,
    runId: run.id,
    sourceConfig: pipeline.sourceConfig as Record<string, unknown>,
    transformConfig: pipeline.transformConfig as Record<string, unknown>,
    destinationConfig: pipeline.destinationConfig as Record<string, unknown>,
  })

  res.status(202).json({ runId: run.id, status: 'queued' })
})

// Keep legacy route for backwards compatibility
router.post('/pipelines/:id/run', async (req: AuthRequest, res: Response): Promise<void> => {
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })

  if (!pipeline) {
    res.status(404).json({ error: 'Pipeline not found' })
    return
  }

  const run = await prisma.run.create({
    data: {
      pipelineId: pipeline.id,
      status: 'running',
    },
  })

  const etlQueue = req.app.get('etlQueue') as QueueType<{
    pipelineId: string
    runId: string
    sourceConfig: Record<string, unknown>
    transformConfig: Record<string, unknown>
    destinationConfig: Record<string, unknown>
  }>

  await etlQueue.add({
    pipelineId: pipeline.id,
    runId: run.id,
    sourceConfig: pipeline.sourceConfig as Record<string, unknown>,
    transformConfig: pipeline.transformConfig as Record<string, unknown>,
    destinationConfig: pipeline.destinationConfig as Record<string, unknown>,
  })

  res.status(202).json({ runId: run.id, status: 'queued' })
})

export default router
