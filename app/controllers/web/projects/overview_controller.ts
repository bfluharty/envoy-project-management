import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import ProjectService from '#services/project_service'
import { ProjectRequest } from '../../../../types/request.js'
import { requestParamsValidator, updateProjectValidator } from '#validators/projects_validator'
import { parseDateFields } from '#utils/date_helper'
import ProjectVendor from '#models/project_vendor'
import { isOnlyActivatingRecord } from '../../../utils/controller_utils.js'

export default class OverviewController {
  /**
   * Update a project's details and/or vendor links
   */
  async update({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { uuid: projectUuid } = await requestParamsValidator.validate(request.params())

    const body = parseDateFields(request)
    const validatedRequest = await updateProjectValidator.validate(body)

    try {
      const { combinedProject, errors } = await ProjectService.updateProject(
        user.uuid,
        projectUuid,
        validatedRequest as ProjectRequest,
        isOnlyActivatingRecord(validatedRequest)
      )
      if (!combinedProject) {
        return response.abort({ error: 'Project not found' }, 404)
      }

      const projectVendors = await ProjectVendor.query()
        .where('project_uuid', projectUuid)
        .where('is_active', true)
        .preload('vendor')
      const linkedVendors = projectVendors.map((pv) => ({
        uuid: pv.vendor.uuid,
        name: pv.vendor.name,
        email: pv.vendor.email,
      }))

      const project = {
        uuid: combinedProject.uuid,
        name: combinedProject.title,
        description: combinedProject.description ?? null,
        location: combinedProject.location ?? null,
        startDate: combinedProject.startDate ?? null,
        endDate: combinedProject.endDate ?? null,
        deadline: combinedProject.deadline ?? null,
        budgetAmount: combinedProject.budgetAmount ?? null,
        goals: combinedProject.goals ?? null,
      }

      if (errors?.length) {
        logger.warn('Project updated with errors:')
        logger.warn(errors)
        return response.json({ project, linkedVendors, errors })
      }
      return response.json({ project, linkedVendors })
    } catch (error) {
      logger.error('Error updating project:')
      logger.error(error)
      return response.status(500).json({ error: 'Failed to update project. Please try again.' })
    }
  }
}
