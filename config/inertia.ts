import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import env from '#start/env'
import { serializeAuthenticatedUser } from '#services/user_avatar_service'

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages
   */
  sharedData: {
    backendUrl: () => {
      const url = env.get('BACKEND_URL') ?? env.get('APP_URL')
      return url ? url.replace(/\/$/, '') : ''
    },
    user: (ctx) => ctx.inertia.always(() => {
      if (!ctx.auth?.user) {
        return null
      }

      return serializeAuthenticatedUser(ctx.auth.user)
    }),
    flash: (ctx) => ({
      success: ctx.session?.flashMessages?.get('success') ?? null,
      error: ctx.session?.flashMessages?.get('error') ?? null,
    }),
    projects: async (ctx) => {
      // Only fetch projects if user is authenticated
      if (!ctx.auth?.user) return []

      try {
        const projectModule = await import('#models/project')
        const Project = projectModule.default
        const projects = await Project.query()
          .where('user_uuid', ctx.auth.user.uuid)
          .where('is_active', true)
          .orderBy('created_timestamp', 'desc')
          .limit(10)

        return projects.map((p) => ({
          uuid: p.uuid,
          title: p.title,
          description: p.description,
        }))
      } catch (error) {
        // Return empty array if there's an error
        return []
      }
    },
  },

  /**
   * Options for the server-side rendering
   */
  ssr: {
    enabled: true,
    entrypoint: 'inertia/app/ssr.ts',
  },
})

export default inertiaConfig

declare module '@adonisjs/inertia/types' {
  export interface SharedProps extends InferSharedProps<typeof inertiaConfig> {}
}
