<script setup>
import { Icon } from '@iconify/vue'

const props = defineProps({
  avg: Number,
  min: Number,
  max: Number,
  category: String
})

const userPrice = ref('')

const result = computed(() => {
  const price = Number(userPrice.value)
  if (!price || !props.avg) return null
  const ratio = price / props.avg
  if (ratio < 0.85) return { text: 'Below market — great deal for buyers!', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: 'mdi:trending-down', bar: 'bg-blue-500' }
  if (ratio > 1.15) return { text: 'Above market — may be hard to sell', color: 'text-red-600 bg-red-50 border-red-200', icon: 'mdi:trending-up', bar: 'bg-red-500' }
  return { text: 'Fair price — within market range', color: 'text-green-600 bg-green-50 border-green-200', icon: 'mdi:check-circle', bar: 'bg-green-500' }
})

const barPosition = computed(() => {
  const price = Number(userPrice.value)
  if (!price || !props.min || !props.max) return 50
  const pos = ((price - props.min) / (props.max - props.min)) * 100
  return Math.min(95, Math.max(5, pos))
})

const formatPrice = (p) => p != null ? `KSh ${Number(p).toLocaleString('en-KE')}` : '—'
</script>

<template>
  <div class="space-y-3">
    <div class="relative">
      <span class="absolute left-3 top-2.5 text-gray-400 text-xs font-medium">KSh</span>
      <input v-model="userPrice" type="number" min="0"
        placeholder="Enter your price to check..."
        class="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
    </div>

    <!-- Price range bar -->
    <div v-if="avg" class="relative">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>{{ formatPrice(min) }}</span>
        <span class="text-green-600 font-semibold">Avg {{ formatPrice(avg) }}</span>
        <span>{{ formatPrice(max) }}</span>
      </div>
      <div class="h-2 bg-gray-200 rounded-full relative">
        <!-- Fair zone -->
        <div class="absolute h-2 bg-green-200 rounded-full"
          style="left: 20%; width: 60%;"></div>
        <!-- Avg marker -->
        <div class="absolute w-0.5 h-4 bg-green-600 rounded-full -top-1" style="left: 50%;"></div>
        <!-- User price marker -->
        <div v-if="userPrice"
          class="absolute w-3 h-3 rounded-full border-2 border-white shadow -top-0.5 transition-all"
          :class="result?.bar ?? 'bg-gray-400'"
          :style="{ left: `${barPosition}%`, transform: 'translateX(-50%)' }">
        </div>
      </div>
    </div>

    <!-- Result -->
    <div v-if="result"
      class="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold"
      :class="result.color">
      <Icon :icon="result.icon" class="w-4 h-4 shrink-0" />
      {{ result.text }}
    </div>
  </div>
</template>