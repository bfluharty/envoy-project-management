import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { processEmailSyncQueue } from '#services/email_sync_event_service'
import { safeError } from '#utils/safe_error'

const DEFAULT_INTERVAL_SECONDS = 60
const MIN_INTERVAL_SECONDS = 1
const RECEIVE_WAIT_TIME_SECONDS = 20

let stopRequested = false
let timer: NodeJS.Timeout | null = null

function getIntervalMs() {
  const configuredSeconds =
    env.get('EMAIL_SYNC_WORKER_INTERVAL_SECONDS') ?? DEFAULT_INTERVAL_SECONDS
  return Math.max(configuredSeconds, MIN_INTERVAL_SECONDS) * 1000
}

function scheduleNextRun() {
  if (stopRequested) {
    return
  }

  timer = setTimeout(() => {
    void runWorkerLoop()
  }, getIntervalMs())
  timer.unref()
}

async function runWorkerLoop() {
  if (stopRequested) {
    return
  }

  try {
    const result = await processEmailSyncQueue({ waitTimeSeconds: RECEIVE_WAIT_TIME_SECONDS })
    logger.info(result, 'Email sync worker run completed')
  } catch (error) {
    logger.error({ err: safeError(error) }, 'Email sync worker run failed')
  } finally {
    scheduleNextRun()
  }
}

export function startEmailSyncQueueWorker() {
  if (!env.get('EMAIL_SYNC_WORKER_ENABLED')) {
    return
  }

  if (timer) {
    return
  }

  stopRequested = false
  logger.info({ intervalSeconds: getIntervalMs() / 1000 }, 'Email sync worker started')
  void runWorkerLoop()
}

export function stopEmailSyncQueueWorker() {
  stopRequested = true
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
