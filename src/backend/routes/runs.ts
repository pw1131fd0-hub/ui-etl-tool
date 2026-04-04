import { Router, Response } from 'express'
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

// POST /api/pipelines/:id/run
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

  // TODO: Enqueue actual pipeline execution via Bull queue
  // For now, mark as completed immediately as placeholder
  setTimeout(async () => {
    try {
      await prisma.run.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          inputRows: 0,
          outputRows: 0,
          completedAt: new Date(),
        },
      })
    } catch {
      // ignore
    }
  }, 100)

  res.status(202).json({ runId: run.id, status: 'queued' })
})

export default router
