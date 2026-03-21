import { Icon, addCollection } from '@iconify/vue'
import mdi from '@iconify-json/mdi/icons.json'

export default defineNuxtPlugin((nuxtApp) => {
  addCollection(mdi)
  nuxtApp.vueApp.component('Icon', Icon)
})