<script setup lang="ts">
import {
  AlertTriangle,
  Check,
  CheckCircle2,
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
import { useDailyLog, type DailySlot } from '@/composables/useDailyLog'
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

const sheetOpen = ref(false)
const sheetMode = ref<'actions' | 'describe'>('actions')
const activeSlot = ref<DailySlot | null>(null)
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

function openActions(slot: DailySlot) {
  if (slot.isOvernight) return // overnight tem botões próprios, sem bottom sheet
  activeSlot.value = slot
  sheetMode.value = 'actions'
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  activeSlot.value = null
  describeText.value = ''
  describeCalories.value = ''
}

function openDescribe() {
  if (!activeSlot.value) return
  describeText.value = activeSlot.value.log?.actual_description ?? ''
  describeCalories.value = activeSlot.value.log?.actual_calories?.toString() ?? ''
  sheetMode.value = 'describe'
}

async function handleDone() {
  if (!activeSlot.value) return
  await markDone(activeSlot.value.slotId)
  closeSheet()
}

async function handleSkip() {
  if (!activeSlot.value) return
  await markSkipped(activeSlot.value.slotId)
  closeSheet()
}

async function handleUndo() {
  if (!activeSlot.value) return
  await undoLog(activeSlot.value.slotId)
  closeSheet()
}

async function handleSaveDescribe() {
  if (!activeSlot.value || !describeText.value.trim()) return
  const calories = describeCalories.value ? Number(describeCalories.value) : null
  await markModified(activeSlot.value.slotId, describeText.value.trim(), calories)
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

      <!-- Overnight: dois botões próprios, sem bottom sheet -->
      <AppCard v-if="slot.isOvernight">
        <div class="flex items-center gap-3">
          <Moon :size="20" :stroke-width="1.75" class="shrink-0 text-accent-blue" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-text">
              <span v-if="slot.scheduledTime" class="text-text-muted">{{ slot.scheduledTime }} </span>{{ slot.slotName }}
            </p>
            <p class="truncate text-xs text-text-muted">{{ slot.description }}</p>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition-colors"
            :class="
              slot.log?.is_prepared
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted'
            "
            @click="markPrepared(slot.slotId)"
          >
            <Check :size="14" :stroke-width="2.5" />
            Preparar
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition-colors"
            :class="
              slot.log?.status === 'done'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted'
            "
            @click="markDone(slot.slotId)"
          >
            <Check :size="14" :stroke-width="2.5" />
            Comi
          </button>
        </div>
      </AppCard>

      <!-- Slots normais: tap abre bottom sheet -->
      <button v-else type="button" class="text-left" @click="openActions(slot)">
        <div
          class="flex items-center gap-3 rounded-[20px] bg-surface px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-border/60"
          :class="[
            slot.log?.status === 'done' ? 'opacity-80' : '',
            !slot.log && isPastTime(slot.scheduledTime) ? 'border-l-4 border-amber-500' : '',
          ]"
        >
          <CheckCircle2
            v-if="slot.log?.status === 'done' && !slot.log.actual_description"
            :size="20"
            :stroke-width="1.75"
            class="shrink-0 text-primary"
          />
          <Pencil
            v-else-if="slot.log?.status === 'done' && slot.log.actual_description"
            :size="20"
            :stroke-width="1.75"
            class="shrink-0 text-accent-blue"
          />
          <SkipForward
            v-else-if="slot.log?.status === 'skipped'"
            :size="20"
            :stroke-width="1.75"
            class="shrink-0 text-text-muted"
          />
          <AlertTriangle
            v-else-if="isPastTime(slot.scheduledTime)"
            :size="20"
            :stroke-width="1.75"
            class="shrink-0 text-amber-500"
          />
          <Square v-else :size="20" :stroke-width="1.75" class="shrink-0 text-text-muted" />

          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-text">
              <span v-if="slot.scheduledTime" class="text-text-muted">{{ slot.scheduledTime }} </span>{{ slot.slotName }}
            </p>
            <p
              v-if="slot.log?.status === 'done' && slot.log.actual_description"
              class="truncate text-xs italic text-text-muted"
            >
              "{{ slot.log.actual_description }}"
            </p>
            <p v-else-if="slot.log?.status === 'skipped'" class="text-xs text-text-muted">Pulado</p>
            <p v-else class="truncate text-xs text-text-muted">{{ slot.log?.status === 'done' ? slot.description : (slot.description || '—') }}</p>
          </div>
        </div>
      </button>
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
      <template v-if="sheetMode === 'actions' && activeSlot">
        <p class="mb-3 text-xs text-text-muted">{{ activeSlot.slotName }}</p>
        <div class="flex flex-col gap-2">
          <button
            v-if="activeSlot.isControllable"
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
            {{ activeSlot.isControllable ? 'Fiz diferente' : 'Registrar' }}
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
            v-if="activeSlot.log"
            type="button"
            class="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-text-muted"
            @click="handleUndo"
          >
            ↩️ Desfazer
          </button>
        </div>
      </template>

      <template v-else-if="sheetMode === 'describe' && activeSlot">
        <p class="mb-3 text-xs text-text-muted">{{ activeSlot.slotName }}</p>
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
