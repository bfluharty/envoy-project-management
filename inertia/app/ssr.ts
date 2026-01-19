/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />
/// <reference types="vite/client" />

import '../css/app.css'

import { createInertiaApp, type ResolvedComponent } from '@inertiajs/svelte'
import { render as svelteRender } from 'svelte/server'
import type { Component } from 'svelte'

interface InertiaPage {
  component: string
  props: Record<string, any>
  url: string
  version: string | null
}

export default function render(page: InertiaPage) {
  return createInertiaApp({
    page,
    resolve: (name: string) => {
      const pages = import.meta.glob<ResolvedComponent>('../pages/**/*.svelte', { eager: true })
      return pages[`../pages/${name}.svelte`]
    },
    setup({ App, props }: { App: Component; props: Record<string, any> }) {
      return svelteRender(App, { props })
    },
  })
}
