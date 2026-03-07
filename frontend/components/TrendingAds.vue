<template>
  <div class="mt-8 grid grid-cols-4 gap-4">
    <div v-for="(ad, index) in ads" :key="index" class="border rounded p-2">
      <img :src="ad.image" class="w-full h-40 object-cover mb-2" />
      <p class="text-sm">{{ ad.title }}</p>
    </div>
  </div>
</template>

<script setup>
const ads = [
  { title: 'Samsung Galaxy S22', image: '/ads/ad1.jpg' },
  { title: 'iPhone 13', image: '/ads/ad2.jpg' },
  { title: 'Samsung S21 Ultra', image: '/ads/ad3.jpg' },
  { title: 'iPhone 12', image: '/ads/ad4.jpg' },
];
</script>

<style scoped></style>