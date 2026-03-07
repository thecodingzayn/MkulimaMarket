<template>
  <NuxtLink :to="`/listings/${product.id}`" class="block">
    <div class="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden">

      <!-- Image -->
      <div class="h-48 bg-gray-100 overflow-hidden">
        <img
          v-if="product.image_url"
          :src="product.image_url"
          :alt="product.title"
          class="w-full h-full object-cover hover:scale-105 transition duration-300"
        />
        <div v-else class="w-full h-full flex items-center justify-center text-4xl">
          🌾
        </div>
      </div>

      <!-- Info -->
      <div class="p-3">
        <h3 class="font-semibold text-gray-800 truncate">{{ product.title }}</h3>
        <p class="text-green-600 font-bold text-lg">KSh {{ product.price }}</p>
        <div class="flex justify-between text-xs text-gray-400 mt-2">
          <span>📍 {{ product.location }}</span>
          <span>{{ product.category }}</span>
        </div>
      </div>

    </div>
  </NuxtLink>
</template>

<script setup>
defineProps({
  product: Object
})
</script>