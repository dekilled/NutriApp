<script setup lang="ts">
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Moon,
  Pencil,
  SkipForward,
  Square,
} from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'

import AppBottomSheet from '@/components/ui/AppBottomSheet.vue'
import AppCard from '@/components/ui/AppCard.vue'
import { useDailyLog, type DailyMealItem, type DailySlot } from '@/composables/useDailyLog'
import { formatWeekdayLong, todayIso } from '@/utils/date'

const {
  currentDate,
  supplements,
  slots,
  loading,
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
  supplementStatus,
  toggleSupplement,
} = useDailyLog()

const dateInputEl = ref<HTMLInputElement | null>(null)

interface ActiveItemContext {
  slotId: number
  slotName: string
  isControllable: boolean
  item: DailyMealItem
}

const sheetOpen = ref(false)
const sheetMode = ref<'actions' | 'describe'>('actions')
const activeItem = ref<ActiveItemContext | null>(null)
const describeText = ref('')
const describeCalories = ref('')

const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

function openDatePicker() {
  const el = dateInputEl.value
  if (!el) return
  if (typeof el.showPicker === 'function') {
    el.showPicker()
  } else {
    el.focus()
  }
}

function onDateInputChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value) void loadDay(value)
}

function nowHHMM(): string {
  void nowTick.value // dependência reativa: força recomputar a cada tick
  return new Date().toTimeString().slice(0, 5)
}

function isPastTime(scheduledTime: string | null): boolean {
  if (!scheduledTime) return false
  if (currentDate.value !== todayIso()) return false
  return scheduledTime < nowHHMM()
}

// Cada slot começa expandido; o usuário pode ocultar a lista de itens.
const expandedSlots = ref<Record<number, boolean>>({})

function isExpanded(slotId: number): boolean {
  return expandedSlots.value[slotId] ?? true
}

function toggleExpanded(slotId: number): void {
  expandedSlots.value[slotId] = !isExpanded(slotId)
}

function slotDoneCount(slot: DailySlot): number {
  return slot.items.filter((item) => item.log?.status === 'done' || item.log?.status === 'skipped').length
}

function openActions(slot: DailySlot, item: DailyMealItem) {
  activeItem.value = { slotId: slot.slotId, slotName: slot.slotName, isControllable: slot.isControllable, item }
  sheetMode.value = 'actions'
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  activeItem.value = null
  describeText.value = ''
  describeCalories.value = ''
}

function openDescribe() {
  if (!activeItem.value) return
  describeText.value = activeItem.value.item.log?.actual_description ?? ''
  describeCalories.value = activeItem.value.item.log?.actual_calories?.toString() ?? ''
  sheetMode.value = 'describe'
}

async function handleDone() {
  if (!activeItem.value) return
  await markDone(activeItem.value.slotId, activeItem.value.item.planMealId)
  closeSheet()
}

async function handleSkip() {
  if (!activeItem.value) return
  await markSkipped(activeItem.value.slotId, activeItem.value.item.planMealId)
  closeSheet()
}

async function handleUndo() {
  if (!activeItem.value) return
  await undoLog(activeItem.value.item.planMealId)
  closeSheet()
}

async function handleSaveDescribe() {
  if (!activeItem.value || !describeText.value.trim()) return
  const calories = describeCalories.value ? Number(describeCalories.value) : null
  await markModified(activeItem.value.slotId, activeItem.value.item.planMealId, describeText.value.trim(), calories)
  closeSheet()
}

function supplementLate(supplementId: number, scheduledTime: string | null): boolean {
  if (!scheduledTime || currentDate.value !== todayIso()) return false
  if (supplementStatus(supplementId)) return false
  return scheduledTime < nowHHMM()
}

onMounted(() => {
  void loadDay(todayIso())
  tickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <div class="flex items-center justify-between rounded-[18px] bg-surface px-3 py-2.5 shadow-[var(--shadow-card)] ring-1 ring-border/60">
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-alt"
        aria-label="Dia anterior"
        @click="navigateDay('prev')"
      >
        <ChevronLeft :size="20" />
      </button>

      <button type="button" class="flex flex-col items-center" @click="openDatePicker">
        <span class="text-sm font-semibold text-text">{{ formatWeekdayLong(currentDate) }}</span>
        <span class="text-[11px] text-text-muted">{{ doneCount }}/{{ totalCount }} refeições</span>
      </button>
      <input
        ref="dateInputEl"
        type="date"
        :value="currentDate"
        class="pointer-events-none absolute h-0 w-0 opacity-0"
        @change="onDateInputChange"
      />

      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-alt"
        aria-label="Próximo dia"
        @click="navigateDay('next')"
      >
        <ChevronRight :size="20" />
      </button>
    </div>

    <p v-if="!loading && !slots.length" class="text-sm text-text-muted">
      Nenhum plano ativo com refeições cadastradas.
    </p>

    <template v-for="(slot, index) in slots" :key="slot.slotId">
      <div v-if="nowDividerIndex === index" class="flex items-center gap-3 py-1">
        <div class="h-px flex-1 bg-primary/40"></div>
        <span class="shrink-0 text-xs font-medium text-primary">agora {{ nowHHMM() }}</span>
        <div class="h-px flex-1 bg-primary/40"></div>
      </div>

      <!-- Um bloco único por refeição, com header expandir/ocultar -->
      <AppCard>
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleExpanded(slot.slotId)">
          <div class="flex min-w-0 items-center gap-3">
            <Moon v-if="slot.isOvernight" :size="20" :stroke-width="1.75" class="shrink-0 text-accent-blue" />
            <div class="min-w-0">
              <p class="text-sm font-medium text-text">
                <span v-if="slot.scheduledTime" class="text-text-muted">{{ slot.scheduledTime }} </span>{{ slot.slotName }}
              </p>
              <p class="text-xs text-text-muted">{{ slotDoneCount(slot) }}/{{ slot.items.length }} itens</p>
            </div>
          </div>
          <ChevronDown
            :size="18"
            :stroke-width="2"
            class="shrink-0 text-text-muted transition-transform"
            :class="{ 'rotate-180': isExpanded(slot.slotId) }"
          />
        </button>

        <div v-if="isExpanded(slot.slotId)" class="mt-3 flex flex-col gap-2">
          <!-- Overnight: dois botões próprios, sem bottom sheet -->
          <div
            v-if="slot.isOvernight"
            v-for="item in slot.items"
            :key="item.planMealId"
            class="rounded-xl bg-surface-alt px-3 py-2.5"
          >
            <p class="mb-2 text-xs text-text-muted">{{ item.description }}</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition-colors"
                :class="
                  item.log?.is_prepared
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-muted'
                "
                @click="markPrepared(slot.slotId, item.planMealId)"
              >
                <Check :size="14" :stroke-width="2.5" />
                Preparar
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition-colors"
                :class="
                  item.log?.status === 'done'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-muted'
                "
                @click="markDone(slot.slotId, item.planMealId)"
              >
                <Check :size="14" :stroke-width="2.5" />
                Comi
              </button>
            </div>
          </div>

          <!-- Slots normais: tap abre bottom sheet -->
          <button
            v-else
            v-for="item in slot.items"
            :key="item.planMealId"
            type="button"
            class="flex items-center gap-3 rounded-xl bg-surface-alt px-3 py-2.5 text-left"
            :class="[
              item.log?.status === 'done' ? 'opacity-80' : '',
              !item.log && isPastTime(slot.scheduledTime) ? 'border-l-4 border-amber-500' : '',
            ]"
            @click="openActions(slot, item)"
          >
            <CheckCircle2
              v-if="item.log?.status === 'done' && !item.log.actual_description"
              :size="18"
              :stroke-width="1.75"
              class="shrink-0 text-primary"
            />
            <Pencil
              v-else-if="item.log?.status === 'done' && item.log.actual_description"
              :size="18"
              :stroke-width="1.75"
              class="shrink-0 text-accent-blue"
            />
            <SkipForward
              v-else-if="item.log?.status === 'skipped'"
              :size="18"
              :stroke-width="1.75"
              class="shrink-0 text-text-muted"
            />
            <AlertTriangle
              v-else-if="isPastTime(slot.scheduledTime)"
              :size="18"
              :stroke-width="1.75"
              class="shrink-0 text-amber-500"
            />
            <Square v-else :size="18" :stroke-width="1.75" class="shrink-0 text-text-muted" />

            <div class="min-w-0 flex-1">
              <p
                v-if="item.log?.status === 'done' && item.log.actual_description"
                class="truncate text-xs italic text-text-muted"
              >
                "{{ item.log.actual_description }}"
              </p>
              <p v-else-if="item.log?.status === 'skipped'" class="text-xs text-text-muted">Pulado</p>
              <p v-else class="truncate text-sm text-text">{{ item.description || '—' }}</p>
            </div>
          </button>
        </div>
      </AppCard>
    </template>

    <AppCard title="Suplementos de hoje">
      <p v-if="!supplements.length" class="text-sm text-text-muted">Nenhum suplemento no plano ativo.</p>
      <ul v-else class="flex flex-col divide-y divide-divider">
        <li
          v-for="supplement in supplements"
          :key="supplement.id"
          class="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
        >
          <button type="button" class="flex flex-1 items-center gap-3 text-left" @click="toggleSupplement(supplement.id)">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              :class="supplementStatus(supplement.id) ? 'bg-primary/15 text-primary' : 'bg-surface-alt text-text-muted'"
            >
              <Check v-if="supplementStatus(supplement.id)" :size="16" :stroke-width="2.5" />
              <Circle v-else :size="16" :stroke-width="1.75" />
            </span>
            <span>
              <p class="text-sm font-medium text-text">{{ supplement.name }}</p>
              <p v-if="supplement.scheduled_time" class="text-xs text-text-muted">{{ supplement.scheduled_time }}</p>
            </span>
          </button>
          <AlertTriangle
            v-if="supplementLate(supplement.id, supplement.scheduled_time)"
            :size="16"
            :stroke-width="1.75"
            class="shrink-0 text-amber-500"
          />
        </li>
      </ul>
    </AppCard>

    <AppBottomSheet :open="sheetOpen" @close="closeSheet">
      <template v-if="sheetMode === 'actions' && activeItem">
        <p class="mb-3 text-xs text-text-muted">{{ activeItem.slotName }} — {{ activeItem.item.description }}</p>
        <div class="flex flex-col gap-2">
          <button
            v-if="activeItem.isControllable"
            type="button"
            class="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3 text-sm font-medium text-text"
            @click="handleDone"
          >
            <CheckCircle2 :size="18" :stroke-width="1.75" class="text-primary" />
            Fiz conforme o plano
          </button>
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3 text-sm font-medium text-text"
            @click="openDescribe"
          >
            <Pencil :size="18" :stroke-width="1.75" class="text-accent-blue" />
            {{ activeItem.isControllable ? 'Fiz diferente' : 'Registrar' }}
          </button>
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3 text-sm font-medium text-text"
            @click="handleSkip"
          >
            <SkipForward :size="18" :stroke-width="1.75" class="text-text-muted" />
            Pulei
          </button>
          <button
            v-if="activeItem.item.log"
            type="button"
            class="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-text-muted"
            @click="handleUndo"
          >
            ↩️ Desfazer
          </button>
        </div>
      </template>

      <template v-else-if="sheetMode === 'describe' && activeItem">
        <p class="mb-3 text-xs text-text-muted">{{ activeItem.slotName }} — {{ activeItem.item.description }}</p>
        <label class="mb-1 block text-sm text-text" for="describe-text">O que você comeu?</label>
        <textarea
          id="describe-text"
          v-model="describeText"
          rows="3"
          class="mb-3 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-primary"
          placeholder="Ex: Comi uma maçã só"
        />
        <label class="mb-1 block text-sm text-text" for="describe-calories">Calorias (opcional)</label>
        <input
          id="describe-calories"
          v-model="describeCalories"
          type="text"
          inputmode="numeric"
          class="mb-4 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
        <button
          type="button"
          class="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-contrast disabled:opacity-60"
          :disabled="!describeText.trim()"
          @click="handleSaveDescribe"
        >
          Salvar
        </button>
      </template>
    </AppBottomSheet>
  </div>
</template>
