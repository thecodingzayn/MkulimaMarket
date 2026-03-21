<template>
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
    <!-- Image skeleton -->
    <div class="w-full h-44 bg-gray-200"></div>
    <!-- Content skeleton -->
    <div class="p-3 space-y-2">
      <!-- Title -->
      <div class="h-4 bg-gray-200 rounded-full w-3/4"></div>
      <!-- Price -->
      <div class="h-4 bg-gray-200 rounded-full w-1/2"></div>
      <!-- Location + category -->
      <div class="flex gap-2 mt-2">
        <div class="h-3 bg-gray-200 rounded-full w-1/3"></div>
        <div class="h-3 bg-gray-200 rounded-full w-1/3"></div>
      </div>
    </div>
  </div>
</template>