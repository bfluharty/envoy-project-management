import type { Request } from '@adonisjs/core/http'

export const parseDate = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  // Extract just the date portion: YYYY-MM-DD
  return value.split('T')[0]
}

export const parseDateFields = (request: Request): Record<string, any> => {
  const body = request.all()
  return {
    ...body,
    startDate: parseDate(body.startDate),
    endDate: parseDate(body.endDate),
    deadline: parseDate(body.deadline),
  }
}
