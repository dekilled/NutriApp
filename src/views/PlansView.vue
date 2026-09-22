<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppCard from '@/components/ui/AppCard.vue'
import { createPlan, listPlans, type NutritionPlan } from '@/services/planService'

const router = useRouter()
const plans = ref<NutritionPlan[]>([])
const loading = ref(true)
const creating = ref(false)
const newLabel = ref('')

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function load() {
  loading.value = true
  try {
    plans.value = await listPlans()
  } finally {
    loading.value = false
  }
}

async function submitNewPlan() {
  if (!newLabel.value.trim()) return
  const id = await createPlan({ label: newLabel.value.trim() })
  newLabel.value = ''
  creating.value = false
  await load()
  router.push({ name: 'plan-detail', params: { id } })
}

function openPlan(id: number) {
  router.push({ name: 'plan-detail', params: { id } })
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-border py-3 text-sm font-medium text-primary transition-colors hover:bg-surface-alt"
      @click="creating = !creating"
    >
      <Plus :size="18" :stroke-width="2" />
      Novo plano
    </button>

    <AppCard v-if="creating">
      <label class="mb-2 block text-sm font-medium text-text" for="new-plan-label">Nome do plano</label>
      <div class="flex gap-2">
        <input
          id="new-plan-label"
          v-model="newLabel"
          type="text"
          placeholder="Ex: Ganho de massa"
          class="flex-1 rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm text-text outline-none focus:border-primary"
          @keyup.enter="submitNewPlan"
        />
        <button
          type="button"
          class="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast"
          @click="submitNewPlan"
        >
          Criar
        </button>
      </div>
    </AppCard>

    <p v-if="!loading && !plans.length" class="text-sm text-text-muted">Nenhum plano criado ainda.</p>

    <AppCard
      v-for="plan in plans"
      :key="plan.id"
      class="cursor-pointer"
      @click="openPlan(plan.id)"
    >
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-text">{{ plan.label }}</p>
          <p class="text-xs text-text-muted">Criado em {{ formatDate(plan.created_at) }}</p>
        </div>
        <span
          v-if="plan.is_active"
          class="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary"
        >
          Ativo
        </span>
      </div>
    </AppCard>
  </div>
</template>
