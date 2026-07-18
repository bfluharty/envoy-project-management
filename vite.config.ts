import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'
import inertia from '@adonisjs/inertia/client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const hmrPort = process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : null

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    ...(hmrPort ? { hmr: { port: hmrPort } } : {}),
  },
  plugins: [
    tailwindcss(),
    inertia({ ssr: { enabled: true, entrypoint: 'inertia/app/ssr.ts' } }),
    svelte(),
    adonisjs({ entrypoints: ['inertia/app/app.ts'], reload: ['resources/views/**/*.edge'] }),
  ],
})
