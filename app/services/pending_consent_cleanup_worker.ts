import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import ModelTrainingEligibilityService from '#services/model_training_eligibility_service'
import PendingConsentCleanupService from '#services/pending_consent_cleanup_service'
import { safeError } from '#utils/safe_error'

const DEFAULT_INTERVAL_HOURS = 24
const MIN_INTERVAL_HOURS = 1

let stopRequested = false
let timer: NodeJS.Timeout | null = null

function cleanupEnabled() {
  return env.get('CONSENT_CLEANUP_ENABLED') ?? env.get('APP_ENV') === 'prod'
}

function intervalMs() {
  const hours = Math.max(
    env.get('CONSENT_CLEANUP_INTERVAL_HOURS') ?? DEFAULT_INTERVAL_HOURS,
    MIN_INTERVAL_HOURS
  )
  return hours * 60 * 60 * 1000
}

function scheduleNextRun() {
  if (stopRequested) return

  timer = setTimeout(() => void runCleanupLoop(), intervalMs())
  timer.unref()
}

async function runCleanupLoop() {
  if (stopRequested) return

  try {
    const abandonedExtractionAttempts =
      await ModelTrainingEligibilityService.reconcileStaleAttempts()
    const result = await PendingConsentCleanupService.cleanupWithLock()
    logger.info(
      { ...result, abandonedExtractionAttempts },
      'Consent compliance cleanup run completed'
    )
  } catch (error) {
    logger.error({ err: safeError(error) }, 'Pending consent cleanup run failed')
  } finally {
    scheduleNextRun()
  }
}

export function startPendingConsentCleanupWorker() {
  if (!cleanupEnabled() || timer) return

  stopRequested = false
  logger.info({ intervalHours: intervalMs() / 3_600_000 }, 'Pending consent cleanup worker started')
  void runCleanupLoop()
}

export function stopPendingConsentCleanupWorker() {
  stopRequested = true
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
