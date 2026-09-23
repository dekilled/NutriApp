// Interface abstrata de TTS. Implementação atual usa a Fish Audio API
// (voz "Emma", fixa via reference_id). Pensada para trocar de provedor
// no futuro sem alterar quem consome useSpeech() — só a implementação
// interna deste módulo muda.
//
// Fila própria: nunca toca dois áudios ao mesmo tempo (fala é sequencial,
// FIFO). Falha de rede/API = silêncio, nunca trava a sessão de exercício
// (ver synthesizeAndPlay). Tudo aqui é assíncrono (fetch/decodeAudioData/
// playback) — nada bloqueia a UI thread, então uma fila simples em memória
// já resolve, sem necessidade de Web Worker.

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

const FISH_TTS_URL = 'https://api.fish.audio/v1/tts'
const DEFAULT_LANG = 'pt-BR'

interface QueueItem {
  text: string
  options: SpeechOptions
  resolve: () => void
}

let sharedAudioContext: AudioContext | null = null
let currentSource: AudioBufferSourceNode | null = null
const queue: QueueItem[] = []
let processing = false

function getAudioContextCtor(): typeof AudioContext | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

/**
 * Cria (ou retoma) o AudioContext compartilhado. Deve ser chamado o mais
 * perto possível de um gesto do usuário (ex: primeira linha de
 * startSession(), antes de qualquer await) para respeitar a política de
 * autoplay do WebView Android.
 */
function ensureAudioContext(): AudioContext | null {
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null

  if (!sharedAudioContext) {
    sharedAudioContext = new Ctor()
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume()
  }
  return sharedAudioContext
}

async function synthesizeAndPlay(text: string, options: SpeechOptions): Promise<void> {
  const apiKey = import.meta.env.VITE_FISH_API_KEY
  const voiceId = import.meta.env.VITE_FISH_VOICE_ID
  if (!apiKey || !voiceId) return // não configurado: silêncio

  try {
    const response = await fetch(FISH_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3',
        model: 's2-pro',
        language: options.lang ?? DEFAULT_LANG,
      }),
    })

    if (!response.ok) return // falha silenciosa

    const audioContext = ensureAudioContext()
    if (!audioContext) return

    const arrayBuffer = await response.arrayBuffer()
    const decoded = await audioContext.decodeAudioData(arrayBuffer)

    const source = audioContext.createBufferSource()
    source.buffer = decoded
    source.connect(audioContext.destination)
    currentSource = source

    await new Promise<void>((resolve) => {
      source.onended = () => resolve()
      source.start()
    })
  } catch {
    // sem internet ou erro de API: silêncio, nunca trava a sessão
  } finally {
    currentSource = null
  }
}

async function drainQueue(): Promise<void> {
  if (processing) return
  processing = true
  while (queue.length > 0) {
    const item = queue.shift()!
    await synthesizeAndPlay(item.text, item.options)
    item.resolve()
  }
  processing = false
}

function speak(text: string, options: SpeechOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ text, options, resolve })
    void drainQueue()
  })
}

function stop(): void {
  queue.length = 0
  if (currentSource) {
    try {
      currentSource.stop()
    } catch {
      // já parado/terminado — ignora
    }
    currentSource = null
  }
}

function getAvailableVoices(): SpeechSynthesisVoice[] {
  // Fish Audio usa uma voz fixa (Emma, via VITE_FISH_VOICE_ID) — não expõe
  // uma lista de vozes do sistema como a Web Speech API expunha.
  return []
}

export function useSpeech(): UseSpeech {
  const isSupported = typeof fetch !== 'undefined' && !!getAudioContextCtor()
  return { speak, stop, getAvailableVoices, isSupported }
}
