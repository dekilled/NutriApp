import { computed, ref } from 'vue'

import {
  getOrCreateDailyLog,
  listMealLogs,
  markMealDone,
  markMealModified,
  markMealSkipped,
  resetMealLog,
  toggleMealPrepared,
  type DailyLog,
  type MealLog,
} from '@/services/dailyLogService'
import { getActivePlan, getSlotConfig, listMealSlots, listPlanMeals } from '@/services/planService'
import {
  listPlanSupplements,
  listSupplementLogs,
  logSupplement,
  type PlanSupplement,
  type SupplementLog,
} from '@/services/supplementService'
import { addDaysIso, todayIso } from '@/utils/date'

export interface DailyMealItem {
  planMealId: number
  description: string
  log: MealLog | null
}

export interface DailySlot {
  slotId: number
  slotName: string
  scheduledTime: string | null
  isControllable: boolean
  isOvernight: boolean
  items: DailyMealItem[]
}

const currentDate = ref(todayIso())
const dailyLog = ref<DailyLog | null>(null)
const mealLogs = ref<MealLog[]>([])
const supplementLogs = ref<SupplementLog[]>([])
const supplements = ref<PlanSupplement[]>([])
const slots = ref<DailySlot[]>([])
const loading = ref(true)
const activePlanId = ref<number | null>(null)

function mealLogForItem(planMealId: number): MealLog | null {
  return mealLogs.value.find((log) => log.plan_meal_id === planMealId) ?? null
}

async function loadDay(date: string): Promise<void> {
  loading.value = true
  currentDate.value = date
  try {
    const activePlan = await getActivePlan()
    activePlanId.value = activePlan?.id ?? null

    const log = await getOrCreateDailyLog(date, activePlan?.id ?? null)
    dailyLog.value = log
    mealLogs.value = await listMealLogs(log.id)

    if (!activePlan) {
      slots.value = []
      supplements.value = []
      supplementLogs.value = []
      return
    }

    const [mealSlotDefs, planMeals, planSupplements, supplementLogList] = await Promise.all([
      listMealSlots(),
      listPlanMeals(activePlan.id),
      listPlanSupplements(activePlan.id),
      listSupplementLogs(log.id),
    ])
    supplements.value = planSupplements
    supplementLogs.value = supplementLogList

    const bySlot = new Map<number, typeof planMeals>()
    for (const item of planMeals) {
      const list = bySlot.get(item.slot_id) ?? []
      list.push(item)
      bySlot.set(item.slot_id, list)
    }

    const built: DailySlot[] = []
    for (const slotDef of mealSlotDefs) {
      const items = bySlot.get(slotDef.id)
      if (!items || items.length === 0) continue

      const config = await getSlotConfig(activePlan.id, slotDef.id)
      built.push({
        slotId: slotDef.id,
        slotName: slotDef.name,
        scheduledTime: items[0].scheduled_time,
        isControllable: config.isControllable,
        isOvernight: config.isOvernight,
        items: items.map((item) => ({
          planMealId: item.id,
          description: item.description,
          log: mealLogForItem(item.id),
        })),
      })
    }

    built.sort((a, b) => (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99'))
    slots.value = built
  } finally {
    loading.value = false
  }
}

function navigateDay(direction: 'prev' | 'next'): void {
  const next = addDaysIso(currentDate.value, direction === 'next' ? 1 : -1)
  void loadDay(next)
}

async function refreshLogs(): Promise<void> {
  if (!dailyLog.value) return
  mealLogs.value = await listMealLogs(dailyLog.value.id)
  supplementLogs.value = await listSupplementLogs(dailyLog.value.id)
  slots.value = slots.value.map((slot) => ({
    ...slot,
    items: slot.items.map((item) => ({ ...item, log: mealLogForItem(item.planMealId) })),
  }))
}

async function markDone(slotId: number, planMealId: number): Promise<void> {
  if (!dailyLog.value) return
  await markMealDone(dailyLog.value.id, slotId, planMealId)
  await refreshLogs()
}

async function markModified(
  slotId: number,
  planMealId: number,
  description: string,
  calories: number | null = null,
): Promise<void> {
  if (!dailyLog.value) return
  await markMealModified(dailyLog.value.id, slotId, planMealId, description, calories)
  await refreshLogs()
}

async function markSkipped(slotId: number, planMealId: number): Promise<void> {
  if (!dailyLog.value) return
  await markMealSkipped(dailyLog.value.id, slotId, planMealId)
  await refreshLogs()
}

async function markPrepared(slotId: number, planMealId: number): Promise<void> {
  if (!dailyLog.value) return
  await toggleMealPrepared(dailyLog.value.id, slotId, planMealId)
  await refreshLogs()
}

async function undoLog(planMealId: number): Promise<void> {
  if (!dailyLog.value) return
  await resetMealLog(dailyLog.value.id, planMealId)
  await refreshLogs()
}

function supplementStatus(supplementId: number): boolean {
  return supplementLogs.value.some((log) => log.plan_supplement_id === supplementId && log.status === 'done')
}

async function toggleSupplement(supplementId: number): Promise<void> {
  if (!dailyLog.value) return
  const next = !supplementStatus(supplementId)
  await logSupplement(dailyLog.value.id, supplementId, next ? 'done' : 'pending')
  supplementLogs.value = await listSupplementLogs(dailyLog.value.id)
}

/** Índice em `slots` onde a divisória "agora" deve ser inserida (só faz sentido para o dia de hoje). */
const nowDividerIndex = computed<number | null>(() => {
  if (currentDate.value !== todayIso()) return null
  const nowHHMM = new Date().toTimeString().slice(0, 5)
  const index = slots.value.findIndex((slot) => (slot.scheduledTime ?? '') > nowHHMM)
  if (index === -1) return slots.value.length > 0 ? slots.value.length : null
  return index === 0 ? null : index
})

const doneCount = computed(() => mealLogs.value.filter((log) => log.status === 'done').length)
const totalCount = computed(() => slots.value.reduce((sum, slot) => sum + slot.items.length, 0))

export function useDailyLog() {
  return {
    currentDate,
    dailyLog,
    mealLogs,
    supplementLogs,
    supplements,
    slots,
    loading,
    activePlanId,
    doneCount,
    totalCount,
    nowDividerIndex,
    loadDay,
    navigateDay,
    markDone,
    markModified,
    markSkipped,
    markPrepared,
    undoLog,
    refreshLogs,
    supplementStatus,
    toggleSupplement,
  }
}
