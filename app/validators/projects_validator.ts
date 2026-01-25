import vine from '@vinejs/vine'
import { retrieveReferences } from '../utils/retrieve_references.js'

export const getUserProjectsValidator = vine.compile(
  vine.object({
    limit: vine.number().positive().optional(),
    offset: vine.number().min(0).optional(),
  })
)

export const getUserProjectByUuidValidator = vine.compile(
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
      .beforeOrEqual('endDate')
      .beforeOrEqual('deadline')
      .optional(),
    endDate: vine
      .date()
      .afterOrEqual('today')
      .afterOrEqual('startDate')
      .beforeOrEqual('deadline')
      .optional(),
    deadline: vine
      .date()
      .afterOrEqual('today')
      .afterOrEqual('startDate')
      .afterOrEqual('endDate')
      .optional(),
    budgetAmount: vine.number().min(0).optional(),
    budgetCurrency: vine.enum(await retrieveReferences('currencies', ['code'])),
    goals: vine.string().optional(),
    isActive: vine.boolean(),
  })
)

export const updateProjectValidator = vine.compile(
  vine.object({
    uuid: vine.string().uuid(),
    title: vine.string().trim().minLength(1).optional(),
    description: vine.string().optional(),
    location: vine.object({}).allowUnknownProperties().optional(),
    startDate: vine
      .date()
      .afterOrEqual('today')
      .beforeOrEqual('endDate')
      .beforeOrEqual('deadline')
      .optional(),
    endDate: vine
      .date()
      .afterOrEqual('today')
      .afterOrEqual('startDate')
      .beforeOrEqual('deadline')
      .optional(),
    deadline: vine
      .date()
      .afterOrEqual('today')
      .afterOrEqual('startDate')
      .afterOrEqual('endDate')
      .optional(),
    budgetAmount: vine.number().min(0).optional(),
    budgetCurrency: vine.enum(await retrieveReferences('currencies', ['code'])).optional(),
    goals: vine.string().optional(),
    isActive: vine.boolean(),
  })
)
