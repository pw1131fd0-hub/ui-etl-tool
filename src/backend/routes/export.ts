import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth.js'

const prisma = new PrismaClient()
const router = Router()

const ExportSchema = z.object({
  pipelineIds: z.array(z.string()).min(1),
})

// Export pipelines as JSON
router.post('/export', authenticate, async (req, res) => {
  try {
    const { pipelineIds } = ExportSchema.parse(req.body)

    const pipelines = await prisma.pipeline.findMany({
      where: {
        id: { in: pipelineIds },
        workspaceId: req.user!.workspaceId,
      },
    })

    const exportData = pipelines.map((p) => ({
      name: p.name,
      description: p.description,
      sourceConfig: p.sourceConfig,
      transformConfig: p.transformConfig,
      destinationConfig: p.destinationConfig,
      schedule: p.schedule,
    }))

    res.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workspace: req.user!.workspaceId,
      pipelines: exportData,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors })
    }
    console.error('[Export] Error:', err)
    res.status(500).json({ error: 'Failed to export pipelines' })
  }
})

// Import pipelines from JSON
router.post('/import', authenticate, async (req, res) => {
  try {
    const ImportSchema = z.object({
      version: z.string(),
      pipelines: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        sourceConfig: z.record(z.unknown()),
        transformConfig: z.record(z.unknown()),
        destinationConfig: z.record(z.unknown()),
        schedule: z.string().optional(),
      })).min(1),
    })

    const body = ImportSchema.parse(req.body)

    const created = []
    for (const p of body.pipelines) {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: p.name,
          description: p.description,
          workspaceId: req.user!.workspaceId,
          sourceConfig: p.sourceConfig,
          transformConfig: p.transformConfig,
          destinationConfig: p.destinationConfig,
          schedule: p.schedule,
          status: 'draft',
        },
      })
      created.push(pipeline)

      // Log activity
      await prisma.activityLog.create({
        data: {
          workspaceId: req.user!.workspaceId,
          userId: req.user!.id,
          action: 'import',
          entityType: 'pipeline',
          entityId: pipeline.id,
          details: { name: pipeline.name },
        },
      })
    }

    res.status(201).json({ imported: created.length, pipelines: created })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors })
    }
    console.error('[Import] Error:', err)
    res.status(500).json({ error: 'Failed to import pipelines' })
  }
})

export default router