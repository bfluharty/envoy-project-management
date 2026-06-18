import UserEntitlement from '#models/user_entitlement'

export type EntitlementCanonicalName = 'CONSUMER' | 'VENDOR' | 'ADMIN'

export default class EntitlementService {
  public static async getIdByCanonicalName(canonicalName: EntitlementCanonicalName) {
    const entitlement = await UserEntitlement.query()
      .where('canonical_name', canonicalName)
      .where('is_active', true)
      .first()

    if (!entitlement) {
      throw new Error(`Active entitlement not found for canonical name: ${canonicalName}`)
    }

    return entitlement.id
  }
}
