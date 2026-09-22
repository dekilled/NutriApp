// Interface abstrata de TTS. Implementação atual usa a Web Speech API do
// navegador/WebView. Pensada para ser trocada por Kokoro (via Fish Audio)
// no futuro sem alterar quem consome useSpeech() — só a implementação
// interna desta função muda.

export interface SpeechOptions {
  voice?: string
  lang?: string
  rate?: number
}

export interface UseSpeech {
  speak(text: string, options?: SpeechOptions): Promise<void>
  stop(): void
  getAvailableVoices(): SpeechSynthesisVoice[]
  isSupported: boolean
}

const DEFAULT_LANG = 'pt-BR'

export function useSpeech(): UseSpeech {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  function getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!isSupported) return []
    return window.speechSynthesis.getVoices()
  }

  function speak(text: string, options: SpeechOptions = {}): Promise<void> {
    if (!isSupported) return Promise.resolve()

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = options.lang ?? DEFAULT_LANG
      utterance.rate = options.rate ?? 1

      if (options.voice) {
        const voice = getAvailableVoices().find((v) => v.name === options.voice)
        if (voice) utterance.voice = voice
      }

      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()

      window.speechSynthesis.speak(utterance)
    })
  }

  function stop(): void {
    if (!isSupported) return
    window.speechSynthesis.cancel()
  }

  return { speak, stop, getAvailableVoices, isSupported }
}
