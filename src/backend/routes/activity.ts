import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth.js'

const prisma = new PrismaClient()
const router = Router()

// List activity logs for workspace
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 100)
    const offset = parseInt(String(req.query.offset ?? '0'))

    const logs = await prisma.activityLog.findMany({
      where: { workspaceId: req.user!.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await prisma.activityLog.count({
      where: { workspaceId: req.user!.workspaceId },
    })

    res.json({ logs, total })
  } catch (err) {
    console.error('[Activity] List error:', err)
    res.status(500).json({ error: 'Failed to fetch activity logs' })
  }
})

export default router