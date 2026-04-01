import Communication from '#models/communication'
import ProjectVendor from '#models/project_vendor'

/**
 * Messages require a Communication row. For inbox email, use the project–vendor
 * link for this user: pick an active ProjectVendor whose project belongs to the user,
 * then find or create channel "email" on that link.
 */
export async function getOrCreateEmailCommunication(
  userUuid: string,
  vendorUuid: string
): Promise<Communication | null> {
  const projectVendor = await ProjectVendor.query()
    .where('vendor_uuid', vendorUuid)
    .where('is_active', true)
    .whereHas('project', (q) => {
      q.where('user_uuid', userUuid)
    })
    .first()

  if (!projectVendor) {
    return null
  }

  let communication = await Communication.query()
    .where('project_vendor_uuid', projectVendor.uuid)
    .where('channel', 'email')
    .first()

  if (!communication) {
    communication = await Communication.create({
      channel: 'email',
      projectVendorUuid: projectVendor.uuid,
    })
  }

  return communication
}
