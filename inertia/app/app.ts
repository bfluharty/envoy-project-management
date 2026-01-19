/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />
/// <reference types="vite/client" />

import '../css/app.css'

import { createInertiaApp, type ResolvedComponent } from '@inertiajs/svelte'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { hydrate, mount } from 'svelte'
import type { Component } from 'svelte'

type ElementWithDataset = {
  dataset: { serverRendered?: string }
  classList: { add: (className: string) => void }
}

createInertiaApp({
  progress: { color: '#5468FF' },

  resolve: (name: string) => {
    return resolvePageComponent<ResolvedComponent>(
      `../pages/${name}.svelte`,
      import.meta.glob<ResolvedComponent>('../pages/**/*.svelte')
    )
  },

  setup({
    el,
    App,
    props,
  }: {
    el: ElementWithDataset
    App: Component
    props: Record<string, any>
  }) {
    if (!el) throw new Error('Missing root element. Make sure to add a div#app to your page')

    if (el.dataset.serverRendered === 'true') {
      hydrate(App, { target: el, props })
    } else {
      mount(App, { target: el, props })
    }

    // Mark as hydrated to show content (prevents FOUC)
    setTimeout(() => {
      el.classList.add('hydrated')
    }, 0)
  },
})
