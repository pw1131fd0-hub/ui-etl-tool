import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '7d'

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const workspaceName = email.split('@')[0] + "'s workspace"

  const workspace = await prisma.workspace.create({
    data: { name: workspaceName },
  })

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      workspaceId: workspace.id,
      role: 'owner',
    },
  })

  const accessToken = jwt.sign(
    { userId: user.id, workspaceId: workspace.id },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_TTL }
  )
  const refreshToken = jwt.sign(
    { userId: user.id, workspaceId: workspace.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: REFRESH_TOKEN_TTL }
  )

  res.status(201).json({
    user: { id: user.id, email: user.email, role: user.role },
    workspace: { id: workspace.id, name: workspace.name },
    accessToken,
    refreshToken,
  })
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { workspace: true },
  })

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const accessToken = jwt.sign(
    { userId: user.id, workspaceId: user.workspaceId },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_TTL }
  )
  const refreshToken = jwt.sign(
    { userId: user.id, workspaceId: user.workspaceId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: REFRESH_TOKEN_TTL }
  )

  res.json({
    user: { id: user.id, email: user.email, role: user.role },
    workspace: { id: user.workspace.id, name: user.workspace.name },
    accessToken,
    refreshToken,
  })
})

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string }

  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' })
    return
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string
      workspaceId: string
    }
    const accessToken = jwt.sign(
      { userId: payload.userId, workspaceId: payload.workspaceId },
      process.env.JWT_SECRET!,
      { expiresIn: ACCESS_TOKEN_TTL }
    )
    res.json({ accessToken })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { workspace: true },
  })

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({
    user: { id: user.id, email: user.email, role: user.role },
    workspace: { id: user.workspace.id, name: user.workspace.name },
  })
})

export default router
