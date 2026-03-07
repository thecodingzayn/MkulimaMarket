<script setup>
const props = defineProps({ date: String })

const timeAgo = computed(() => {
  const now = new Date()
  const past = new Date(props.date)
  const diff = Math.floor((now - past) / 1000)

  if (diff < 60) return `${diff} sec ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`
  return new Date(props.date).toLocaleDateString('en-KE')
})
</script>

<template>
  <span>{{ timeAgo }}</span>
</template>