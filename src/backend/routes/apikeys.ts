import { Router, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const router = Router()
router.use(authenticate)

// GET /api/apikeys - list API keys
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: req.workspaceId },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(keys)
})

// POST /api/apikeys - create API key
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name } = req.body
  if (!name) {
    res.status(400).json({ error: 'Name is required' })
    return
  }

  const rawKey = `etl_${crypto.randomBytes(24).toString('hex')}`
  const keyHash = await bcrypt.hash(rawKey, 10)

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      workspaceId: req.workspaceId!,
    },
  })

  res.status(201).json({ id: apiKey.id, name: apiKey.name, key: rawKey, createdAt: apiKey.createdAt })
})

// DELETE /api/apikeys/:id - delete API key
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const key = await prisma.apiKey.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  })
  if (!key) {
    res.status(404).json({ error: 'API key not found' })
    return
  }

  await prisma.apiKey.delete({ where: { id: key.id } })
  res.status(204).send()
})

export default router