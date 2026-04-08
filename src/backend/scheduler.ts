import cron from 'node-cron'
import { prisma } from './config/prisma.js'
import type { Queue } from 'bull'

type ETLJob = {
  pipelineId: string
  runId: string
  sourceConfig: Record<string, unknown>
  transformConfig: Record<string, unknown>
  destinationConfig: Record<string, unknown>
}

// Stores active cron tasks keyed by pipeline id
const scheduledTasks = new Map<string, cron.ScheduledTask>()

export function schedulePipeline(
  pipelineId: string,
  cronExpr: string,
  etlQueue: Queue<ETLJob>
) {
  if (!cron.validate(cronExpr)) {
    console.warn(`[Scheduler] Invalid cron expr for pipeline ${pipelineId}: ${cronExpr}`)
    return
  }

  const existing = scheduledTasks.get(pipelineId)
  if (existing) {
    existing.stop()
    scheduledTasks.delete(pipelineId)
  }

  const task = cron.schedule(cronExpr, async () => {
    try {
      console.log(`[Scheduler] Running pipeline ${pipelineId}`)

      const run = await prisma.run.create({
        data: { pipelineId, status: 'running' },
      })

      const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
      if (!pipeline || pipeline.status !== 'active') {
        console.log(`[Scheduler] Pipeline ${pipelineId} no longer active, skipping`)
        return
      }

      await etlQueue.add({
        pipelineId: pipeline.id,
        runId: run.id,
        sourceConfig: pipeline.sourceConfig as Record<string, unknown>,
        transformConfig: pipeline.transformConfig as Record<string, unknown>,
        destinationConfig: pipeline.destinationConfig as Record<string, unknown>,
      })

      console.log(`[Scheduler] Pipeline ${pipelineId} queued as run ${run.id}`)
    } catch (err) {
      console.error(`[Scheduler] Error running pipeline ${pipelineId}:`, err)
    }
  })

  scheduledTasks.set(pipelineId, task)
  console.log(`[Scheduler] Scheduled pipeline ${pipelineId} with cron: ${cronExpr}`)
}

export function unschedulePipeline(pipelineId: string) {
  const task = scheduledTasks.get(pipelineId)
  if (task) {
    task.stop()
    scheduledTasks.delete(pipelineId)
    console.log(`[Scheduler] Unscheduled pipeline ${pipelineId}`)
  }
}

export async function initScheduler(etlQueue: Queue<ETLJob>) {
  try {
    const pipelines = await prisma.pipeline.findMany({
      where: { status: 'active', schedule: { not: null } },
    })

    for (const p of pipelines) {
      if (p.schedule) schedulePipeline(p.id, p.schedule, etlQueue)
    }

    console.log(`[Scheduler] Initialized ${pipelines.length} scheduled pipelines`)
  } catch (err) {
    console.error('[Scheduler] Init error:', err)
  }
}
