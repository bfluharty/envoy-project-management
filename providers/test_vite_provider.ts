import type { ApplicationService } from '@adonisjs/core/types'
import { Vite } from '@adonisjs/vite'
import type { ViteOptions } from '@adonisjs/vite/types'
import ViteMiddleware from '@adonisjs/vite/vite_middleware'

export default class TestViteProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    const config = this.app.config.get('vite') as ViteOptions
    const vite = new Vite(false, config)

    this.app.container.bind('vite', () => vite)
    this.app.container.singleton(ViteMiddleware, () => new ViteMiddleware(vite))
  }
}
