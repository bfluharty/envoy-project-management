import { writable } from 'svelte/store'

export const showNewProjectForm = writable(false)

export type ColorMode = 'system' | 'light' | 'dark'

const VALID_MODES: ColorMode[] = ['system', 'light', 'dark']

function createColorModeStore() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('color-mode') : null
  const stored = VALID_MODES.includes(raw as ColorMode) ? (raw as ColorMode) : null
  const { subscribe, set: internalSet } = writable<ColorMode>(stored ?? 'system')

  function applyMode(mode: ColorMode) {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    if (mode === 'dark') {
      html.classList.add('dark')
    } else if (mode === 'light') {
      html.classList.add('light')
    } else if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      html.classList.add('dark')
    }
  }

  return {
    subscribe,
    set(mode: ColorMode) {
      localStorage.setItem('color-mode', mode)
      applyMode(mode)
      internalSet(mode)
    },
    applyMode,
  }
}

export const colorMode = createColorModeStore()
