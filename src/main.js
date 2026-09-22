import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initDatabase } from './services/database'

import './assets/styles/main.css'

async function bootstrap() {
  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  try {
    await initDatabase()
  } catch (error) {
    console.error('[bootstrap] Falha ao iniciar o banco de dados:', error)
  }

  app.mount('#app')
}

bootstrap()
