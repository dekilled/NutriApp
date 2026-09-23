/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FISH_API_KEY?: string
  readonly VITE_FISH_VOICE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
