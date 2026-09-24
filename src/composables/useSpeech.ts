// Interface abstrata de TTS. Implementação atual usa a Fish Audio API
// (voz "Emma", fixa via reference_id). Pensada para trocar de provedor
// no futuro sem alterar quem consome useSpeech() — só a implementação
// interna deste módulo muda.
//
// speak() usa exatamente a abordagem do playground da Fish Audio: sem
// AudioContext, sem decodeAudioData — toca direto via elemento <audio>
// a partir de um Blob URL. Não há fila: chamadas concorrentes podem
// sobrepor áudio (trade-off aceito para simplificar depois de vários
// problemas de decodificação/autoplay no WebView Android).

export interface UseSpeech {
  speak(text: string): Promise<void>
  stop(): void
  getAvailableVoices(): SpeechSynthesisVoice[]
  isSupported: boolean
}

let currentAudioEl: HTMLAudioElement | null = null

async function speak(text: string): Promise<void> {
  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_FISH_API_KEY}`,
        'Content-Type': 'application/json',
        model: 's2.1-pro-free',
      },
      body: JSON.stringify({
        text: text,
        reference_id: import.meta.env.VITE_FISH_VOICE_ID,
        format: 'mp3',
      }),
    })

    const arrayBuffer = await response.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    currentAudioEl = audio
    audio.play()
    audio.onended = () => URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[Emma] erro:', e)
  }
}

function stop(): void {
  if (currentAudioEl) {
    currentAudioEl.pause()
    currentAudioEl = null
  }
}

function getAvailableVoices(): SpeechSynthesisVoice[] {
  // Fish Audio usa uma voz fixa (Emma, via VITE_FISH_VOICE_ID) — não expõe
  // uma lista de vozes do sistema como a Web Speech API expunha.
  return []
}

export function useSpeech(): UseSpeech {
  const isSupported = typeof fetch !== 'undefined'
  return { speak, stop, getAvailableVoices, isSupported }
}
