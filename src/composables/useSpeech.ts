// Interface abstrata de TTS. Implementação atual usa a Fish Audio API
// (voz "Emma", fixa via reference_id). Pensada para trocar de provedor
// no futuro sem alterar quem consome useSpeech() — só a implementação
// interna deste módulo muda.
//
// Blob URL (URL.createObjectURL) não é reproduzível pelo elemento
// <audio> dentro do WebView do Capacitor Android, e o próprio <audio>
// com URI de arquivo também se mostrou pouco confiável ali. Por isso o
// áudio é salvo como arquivo real no cache do app via
// @capacitor/filesystem e tocado pelo player nativo do
// @capacitor-community/native-audio, sendo descarregado e apagado logo
// em seguida. Não há fila: chamadas concorrentes podem sobrepor áudio
// (trade-off aceito para simplificar depois de vários problemas de
// decodificação/autoplay no WebView Android).

import { Directory, Filesystem } from '@capacitor/filesystem'
import { NativeAudio } from '@capacitor-community/native-audio'

export interface UseSpeech {
  speak(text: string): Promise<void>
  stop(): void
  getAvailableVoices(): SpeechSynthesisVoice[]
  isSupported: boolean
}

const AUDIO_POLL_INTERVAL_MS = 200

let currentAssetId: string | null = null

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
        text,
        reference_id: import.meta.env.VITE_FISH_VOICE_ID,
        format: 'mp3',
      }),
    })

    // Converter para base64
    const arrayBuffer = await response.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Salvar arquivo temporário
    const fileName = `emma_${Date.now()}.mp3`
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })

    // Tocar via player nativo
    const audioId = `emma_${Date.now()}`
    currentAssetId = audioId

    await NativeAudio.preload({
      assetId: audioId,
      assetPath: result.uri,
      audioChannelNum: 1,
      isUrl: true,
    })

    await NativeAudio.play({ assetId: audioId })

    await new Promise((resolve) => {
      const interval = setInterval(async () => {
        const status = await NativeAudio.isPlaying({ assetId: audioId })
        if (!status.isPlaying) {
          clearInterval(interval)
          await NativeAudio.unload({ assetId: audioId })
          resolve(null)
        }
      }, AUDIO_POLL_INTERVAL_MS)
    })

    // Limpar arquivo
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Cache,
    })
  } catch (e) {
    console.error('[Emma] erro:', e)
  } finally {
    currentAssetId = null
  }
}

function stop(): void {
  if (currentAssetId) {
    const assetId = currentAssetId
    currentAssetId = null
    void NativeAudio.stop({ assetId })
    void NativeAudio.unload({ assetId })
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
