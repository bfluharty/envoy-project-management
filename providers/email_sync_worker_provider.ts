import {
  startEmailSyncQueueWorker,
  stopEmailSyncQueueWorker,
} from '#services/email_sync_queue_worker'

export default class EmailSyncWorkerProvider {
  ready() {
    startEmailSyncQueueWorker()
  }

  shutdown() {
    stopEmailSyncQueueWorker()
  }
}
