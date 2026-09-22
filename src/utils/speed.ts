import type { ActivitySegment } from '@/services/activityService'

/**
 * Estimativa de velocidade média da sessão a partir do mix de segmentos.
 * O schema atual não guarda velocidade/distância real (sem GPS); usamos os
 * limiares configurados em Settings como referência por tipo de segmento.
 */
export function estimateAverageSpeedKmh(
  segments: Pick<ActivitySegment, 'type' | 'duration_s'>[],
  walkMaxSpeedKmh: number,
  runMinSpeedKmh: number,
): number {
  let totalDuration = 0
  let weightedSpeed = 0

  for (const segment of segments) {
    const duration = segment.duration_s ?? 0
    const speed =
      segment.type === 'run' ? runMinSpeedKmh * 1.1 : segment.type === 'walk' ? walkMaxSpeedKmh * 0.8 : 0

    totalDuration += duration
    weightedSpeed += duration * speed
  }

  return totalDuration > 0 ? weightedSpeed / totalDuration : 0
}
