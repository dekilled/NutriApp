import { Apple, Coffee, Cookie, Dumbbell, IceCream2, Moon, Soup, UtensilsCrossed, Zap } from 'lucide-vue-next'
import type { Component } from 'vue'

const ICONS_BY_SLOT_NAME: Record<string, Component> = {
  'Café da manhã': Coffee,
  'Lanche manhã': Apple,
  Almoço: UtensilsCrossed,
  Sobremesa: IceCream2,
  'Lanche tarde': Cookie,
  'Pré-treino': Zap,
  'Pós-treino': Dumbbell,
  Jantar: Soup,
  Ceia: Moon,
}

export function iconForSlot(slotName: string): Component {
  return ICONS_BY_SLOT_NAME[slotName] ?? UtensilsCrossed
}
