import {
  startPendingConsentCleanupWorker,
  stopPendingConsentCleanupWorker,
} from '#services/pending_consent_cleanup_worker'

export default class PendingConsentCleanupProvider {
  ready() {
    startPendingConsentCleanupWorker()
  }

  shutdown() {
    stopPendingConsentCleanupWorker()
  }
}
