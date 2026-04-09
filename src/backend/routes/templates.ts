import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth.js'

const prisma = new PrismaClient()
const router = Router()

const TemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceConfig: z.record(z.unknown()),
  transformConfig: z.record(z.unknown()),
  destinationConfig: z.record(z.unknown()),
  category: z.string().default('custom'),
  isPublic: z.boolean().default(false),
})

// List templates for workspace
router.get('/', authenticate, async (req, res) => {
  try {
    const templates = await prisma.pipelineTemplate.findMany({
      where: {
        OR: [
          { workspaceId: req.user!.workspaceId },
          { isPublic: true },
        ],
      },
      orderBy: { usageCount: 'desc' },
    })
    res.json(templates)
  } catch (err) {
    console.error('[Templates] List error:', err)
    res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

// Get single template
router.get('/:id', authenticate, async (req, res) => {
  try {
    const template = await prisma.pipelineTemplate.findUnique({
      where: { id: req.params.id },
    })
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    if (template.workspaceId !== req.user!.workspaceId && !template.isPublic) {
      return res.status(403).json({ error: 'Access denied' })
    }
    res.json(template)
  } catch (err) {
    console.error('[Templates] Get error:', err)
    res.status(500).json({ error: 'Failed to fetch template' })
  }
})

// Create template from pipeline
router.post('/', authenticate, async (req, res) => {
  try {
    const body = TemplateSchema.parse(req.body)
    const template = await prisma.pipelineTemplate.create({
      data: {
        ...body,
        workspaceId: req.user!.workspaceId,
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        workspaceId: req.user!.workspaceId,
        userId: req.user!.id,
        action: 'create',
        entityType: 'template',
        entityId: template.id,
        details: { name: template.name },
      },
    })

    res.status(201).json(template)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors })
    }
    console.error('[Templates] Create error:', err)
    res.status(500).json({ error: 'Failed to create template' })
  }
})

// Update template
router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.pipelineTemplate.findUnique({
      where: { id: req.params.id },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' })
    }
    if (existing.workspaceId !== req.user!.workspaceId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const body = TemplateSchema.partial().parse(req.body)
    const template = await prisma.pipelineTemplate.update({
      where: { id: req.params.id },
      data: body,
    })
    res.json(template)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors })
    }
    console.error('[Templates] Update error:', err)
    res.status(500).json({ error: 'Failed to update template' })
  }
})

// Delete template
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.pipelineTemplate.findUnique({
      where: { id: req.params.id },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' })
    }
    if (existing.workspaceId !== req.user!.workspaceId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.pipelineTemplate.delete({
      where: { id: req.params.id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        workspaceId: req.user!.workspaceId,
        userId: req.user!.id,
        action: 'delete',
        entityType: 'template',
        entityId: req.params.id,
        details: { name: existing.name },
      },
    })

    res.status(204).send()
  } catch (err) {
    console.error('[Templates] Delete error:', err)
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

// Create pipeline from template
router.post('/:id/instantiate', authenticate, async (req, res) => {
  try {
    const template = await prisma.pipelineTemplate.findUnique({
      where: { id: req.params.id },
    })
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    if (template.workspaceId !== req.user!.workspaceId && !template.isPublic) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Increment usage count
    await prisma.pipelineTemplate.update({
      where: { id: req.params.id },
      data: { usageCount: { increment: 1 } },
    })

    // Create pipeline from template
    const pipeline = await prisma.pipeline.create({
      data: {
        name: req.body.name || `${template.name} (Copy)`,
        description: template.description,
        workspaceId: req.user!.workspaceId,
        sourceConfig: template.sourceConfig,
        transformConfig: template.transformConfig,
        destinationConfig: template.destinationConfig,
        status: 'draft',
      },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        workspaceId: req.user!.workspaceId,
        userId: req.user!.id,
        action: 'create',
        entityType: 'pipeline',
        entityId: pipeline.id,
        details: { fromTemplate: template.id, name: pipeline.name },
      },
    })

    res.status(201).json(pipeline)
  } catch (err) {
    console.error('[Templates] Instantiate error:', err)
    res.status(500).json({ error: 'Failed to create pipeline from template' })
  }
})

export default router