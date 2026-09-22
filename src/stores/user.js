import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const profile = ref(null)

  function setProfile(newProfile) {
    profile.value = newProfile
  }

  return { profile, setProfile }
})
