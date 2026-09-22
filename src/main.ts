import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initDatabase } from './db'

import './assets/styles/main.css'

async function bootstrap() {
  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  try {
    // Evita que uma falha/travamento na inicialização do SQLite (nativo ou
    // fallback web) deixe a tela em branco indefinidamente.
    await Promise.race([
      initDatabase(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ])
  } catch (error) {
    console.error('[bootstrap] Falha ao iniciar o banco de dados:', error)
  }

  app.mount('#app')
}

bootstrap()
