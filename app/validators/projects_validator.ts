import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export const getUserProjectsValidator = vine.compile(
  vine.object({
    limit: vine.number().min(1).optional(),
    offset: vine.number().min(0).optional(),
  })
)

export const requestParamsValidator = vine.compile(
  vine.object({
    uuid: vine.string().uuid(),
  })
)

export const createProjectValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1),
    description: vine.string().optional(),
    location: vine.object({}).allowUnknownProperties().optional(),
    startDate: vine
      .date()
      .afterOrEqual('today')
      .beforeOrSameAs('endDate')
      .beforeOrSameAs('deadline')
      .transform((date) => DateTime.fromJSDate(date))
      .optional(),
    endDate: vine
      .date()
      .afterOrEqual('today')
      .afterOrSameAs('startDate')
      .beforeOrSameAs('deadline')
      .transform((date) => DateTime.fromJSDate(date))
      .optional(),
    deadline: vine
      .date()
      .afterOrEqual('today')
      .afterOrSameAs('startDate')
      .afterOrSameAs('endDate')
      .transform((date) => DateTime.fromJSDate(date))
      .optional(),
    budgetAmount: vine.number().min(0).optional(),
    budgetCurrency: vine.string().optional(),
    goals: vine.string().optional(),
    isActive: vine.boolean().optional(),
    vendors: vine.array(vine.string().uuid()).optional(),
  })
)

export const updateProjectValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).optional(),
    description: vine.string().optional(),
    location: vine.object({}).allowUnknownProperties().optional(),
    startDate: vine
      .date()
      .transform((date) => DateTime.fromJSDate(date))
      .optional(),
    endDate: vine
      .date()
      .transform((date) => DateTime.fromJSDate(date))
      .optional(),
    deadline: vine
      .date()
      .transform((date) => DateTime.fromJSDate(date))
      .optional(),
    budgetAmount: vine.number().min(0).optional(),
    budgetCurrency: vine.string().optional(),
    goals: vine.string().optional(),
    isActive: vine.boolean().optional(),
    vendors: vine.array(vine.string().uuid()).optional(),
  })
)

export const chatProjectValidator = vine.compile(
  vine.object({
    prompt: vine.string().trim().minLength(1),
    variables: vine.object({}).allowUnknownProperties().optional(),
  })
)
