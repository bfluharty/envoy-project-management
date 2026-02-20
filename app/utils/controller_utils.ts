import User from '#models/user'

export const isOnlyActivatingRecord = (validatedRequest: Record<string, any>): boolean => {
  if (!validatedRequest || typeof validatedRequest !== 'object') return false
  const keys = Object.keys(validatedRequest).filter((k) => validatedRequest[k] !== undefined)
  return keys.length === 1 && keys[0] === 'isActive' && validatedRequest.isActive === true
}

export const validateUser = async (userId: string | undefined) => {
  if (!userId) {
    throw new Error('User ID was not provided.')
  }
  return await User.query().where('uuid', userId).andWhere('isActive', true).first()
}
