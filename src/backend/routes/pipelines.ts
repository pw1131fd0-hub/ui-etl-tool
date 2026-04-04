import { Router, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

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

  const workspace = await prisma.workspace.findUnique({
    where: { id: req.workspaceId },
  })

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' })
    return
  }

  const pipelineCount = await prisma.pipeline.count({
    where: { workspaceId: req.workspaceId },
  })

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

  res.status(201).json(pipeline)
})

// GET /api/pipelines/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: { runs: { take: 100, orderBy: { startedAt: 'desc' } } },
  })

  if (!pipeline) {
    res.status(404).json({ error: 'Pipeline not found' })
    return
  }

  res.json(pipeline)
})

// PUT /api/pipelines/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, sourceConfig, transformConfig, destinationConfig, schedule, status } = req.body

  const existing = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })

  if (!existing) {
    res.status(404).json({ error: 'Pipeline not found' })
    return
  }

  const pipeline = await prisma.pipeline.update({
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

  res.json(pipeline)
})

// DELETE /api/pipelines/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.pipeline.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })

  if (!existing) {
    res.status(404).json({ error: 'Pipeline not found' })
    return
  }

  await prisma.pipeline.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export default router
