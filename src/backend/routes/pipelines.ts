import { Router, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { schedulePipeline, unschedulePipeline } from '../scheduler.js'
import type { Queue } from 'bull'

const router = Router()
router.use(authenticate)

type ETLJob = {
  pipelineId: string; runId: string
  sourceConfig: Record<string, unknown>; transformConfig: Record<string, unknown>
  destinationConfig: Record<string, unknown>
}
function getQueue(req: express.Request): Queue<ETLJob> {
  return req.app.get('etlQueue') as Queue<ETLJob>
}

// GET /api/pipelines
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const pipelines = await prisma.pipeline.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { runs: true } } },
  })
  res.json(pipelines)
})

// POST /api/pipelines
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, sourceConfig, transformConfig, destinationConfig, schedule } = req.body

  if (!name) {
    res.status(400).json({ error: 'Pipeline name is required' })
    return
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: req.workspaceId } })
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const pipelineCount = await prisma.pipeline.count({ where: { workspaceId: req.workspaceId } })
  if (pipelineCount >= workspace.pipelineLimit) {
    res.status(403).json({
      error: `Pipeline limit reached (${workspace.plan} plan allows ${workspace.pipelineLimit} pipelines)`,
    })
    return
  }

  const pipeline = await prisma.pipeline.create({
    data: {
      name,
      description: description ?? null,
      workspaceId: req.workspaceId!,
      sourceConfig: sourceConfig ?? {},
      transformConfig: transformConfig ?? {},
      destinationConfig: destinationConfig ?? {},
      schedule: schedule ?? null,
    },
  })

  // Auto-schedule if has cron expression
  if (pipeline.schedule && pipeline.status === 'active') {
    schedulePipeline(pipeline.id, pipeline.schedule, getQueue(req))
  }

  res.status(201).json(pipeline)
})

// GET /api/pipelines/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: { runs: { take: 100, orderBy: { startedAt: 'desc' } } },
  })
  if (!pipeline) { res.status(404).json({ error: 'Pipeline not found' }); return }
  res.json(pipeline)
})

// PUT /api/pipelines/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, sourceConfig, transformConfig, destinationConfig, schedule, status } = req.body

  const existing = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })
  if (!existing) { res.status(404).json({ error: 'Pipeline not found' }); return }

  const updated = await prisma.pipeline.update({
    where: { id: req.params.id },
    data: {
      name: name ?? existing.name,
      description: description !== undefined ? description : existing.description,
      sourceConfig: sourceConfig ?? existing.sourceConfig,
      transformConfig: transformConfig ?? existing.transformConfig,
      destinationConfig: destinationConfig ?? existing.destinationConfig,
      schedule: schedule !== undefined ? schedule : existing.schedule,
      status: status ?? existing.status,
    },
  })

  // Update scheduler
  const etlQueue = getQueue(req)
  unschedulePipeline(updated.id)
  if (updated.schedule && updated.status === 'active') {
    schedulePipeline(updated.id, updated.schedule, etlQueue)
  }

  res.json(updated)
})

// DELETE /api/pipelines/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })
  if (!existing) { res.status(404).json({ error: 'Pipeline not found' }); return }

  unschedulePipeline(existing.id)
  await prisma.pipeline.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

// POST /api/pipelines/:id/clone — clone a pipeline
router.post('/:id/clone', async (req: AuthRequest, res: Response): Promise<void> => {
  const source = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })
  if (!source) { res.status(404).json({ error: 'Pipeline not found' }); return }

  const cloned = await prisma.pipeline.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      workspaceId: req.workspaceId!,
      sourceConfig: source.sourceConfig,
      transformConfig: source.transformConfig,
      destinationConfig: source.destinationConfig,
      schedule: null, // Don't copy schedule — require explicit enable
      status: 'draft',
    },
  })

  res.status(201).json(cloned)
})

// POST /api/pipelines/batch-delete — delete multiple pipelines
router.post('/batch-delete', async (req: AuthRequest, res: Response): Promise<void> => {
  const { ids } = req.body as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array required' })
    return
  }

  // Verify ownership
  const pipelines = await prisma.pipeline.findMany({
    where: { id: { in: ids }, workspaceId: req.workspaceId },
  })
  if (pipelines.length === 0) { res.status(404).json({ error: 'No pipelines found' }); return }

  // Unschedule all first
  for (const p of pipelines) unschedulePipeline(p.id)

  await prisma.pipeline.deleteMany({ where: { id: { in: pipelines.map(p => p.id) } } })
  res.json({ deleted: pipelines.length })
})

// PATCH /api/pipelines/:id/status — quick status toggle (activate/deactivate)
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body as { status: string }
  if (!['active', 'inactive', 'draft'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' })
    return
  }

  const existing = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })
  if (!existing) { res.status(404).json({ error: 'Pipeline not found' }); return }

  const updated = await prisma.pipeline.update({
    where: { id: req.params.id },
    data: { status },
  })

  const etlQueue = getQueue(req)
  unschedulePipeline(updated.id)
  if (updated.schedule && updated.status === 'active') {
    schedulePipeline(updated.id, updated.schedule, etlQueue)
  }

  res.json(updated)
})

export default router
