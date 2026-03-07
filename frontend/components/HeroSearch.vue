<template>
  <section class="bg-green-600 text-white py-20 rounded-b-3xl">
    <div class="max-w-5xl mx-auto text-center">

      <h2 class="text-3xl font-bold mb-6">
        What are you looking for?
      </h2>

      <div class="flex justify-center gap-3">

        <!-- Location -->
        <select class="px-4 py-3 rounded-lg text-gray-700">
          <option>All Kenya</option>
          <option>Nairobi</option>
          <option>Eldoret</option>
          <option>Nakuru</option>
        </select>

        <!-- Search -->
         <div class="flex">
          <input
          type="text"
          placeholder="I am looking for..."
          class="w-96 px-4 rounded-l-lg py-3 text-gray-700"
        />

        <button class="bg-white text-green-700 px-4 rounded-r-lg hover:bg-gray-100 transition">
        🔍
      </button>


         </div>
        

      </div>

    </div>
  </section>
</template>