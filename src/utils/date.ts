export const WEEKDAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Segunda-feira da semana que contém a data informada (ISO). */
export function startOfWeekIso(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`)
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  return addDaysIso(dateIso, diffToMonday)
}

export function startOfMonthIso(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`
}

export function formatShortDate(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
