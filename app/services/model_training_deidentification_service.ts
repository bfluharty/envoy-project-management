/**
 * Unrestricted user-authored text/JSON is quarantined until Envoy connects an approved
 * de-identification provider. Heuristic replacement is intentionally not accepted as proof that
 * arbitrary content contains no direct identifiers.
 */
export class ModelTrainingDeidentificationApprovalRequiredError extends Error {
  readonly code = 'MODEL_TRAINING_DEIDENTIFICATION_APPROVAL_REQUIRED'

  constructor() {
    super('The source record requires an approved de-identification process before export.')
    this.name = 'ModelTrainingDeidentificationApprovalRequiredError'
  }
}

export default class ModelTrainingDeidentificationService {
  /**
   * The sole export-boundary API for source-view content. Keep this fail closed until an approved
   * DLP/NER implementation can replace the quarantine after its output has been validated.
   */
  static deidentifyForExport(content: unknown): null | undefined {
    if (content !== null && content !== undefined) {
      throw new ModelTrainingDeidentificationApprovalRequiredError()
    }

    return content
  }
}
