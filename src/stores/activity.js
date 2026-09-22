import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useActivityStore = defineStore('activity', () => {
  const activities = ref([])

  function setActivities(newActivities) {
    activities.value = newActivities
  }

  return { activities, setActivities }
})
