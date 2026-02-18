import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages
   */
  sharedData: {
    user: (ctx) => ctx.inertia.always(() => ctx.auth.user),
    flash: (ctx) => ({
      success: ctx.session.flashMessages.get('success'),
      error: ctx.session.flashMessages.get('error'),
    }),
    projects: async (ctx) => {
      // Only fetch projects if user is authenticated
      if (!ctx.auth.user) return []

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
