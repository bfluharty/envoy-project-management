/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

router
  .group(() => {
    router.get('/', async () => {
      return {
        response: 'Get all projects for user.',
      }
    })

    router.get('/:uuid', async ({ params }) => {
      return {
        response: `Get project: ${params.uuid}`,
      }
    })

    router.post('/', async () => {
      return {
        response: 'Create a new project.',
      }
    })

    router.patch('/:uuid', async () => {
      return {
        response: 'Update a project.',
      }
    })

    router.post('/:uuid/chat', async () => {
      return {
        response: 'Send a new chat.',
      }
    })
  })
  .prefix('/projects')
