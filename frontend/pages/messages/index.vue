<script setup>
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const { data: conversations, refresh } = await useAsyncData('conversations', async () => {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, created_at, listing_id,
      initiator_id, recipient_id,
      products(id, title, image_url)
    `)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) console.error('conversations error:', error)
  return data ?? []
})

const { data: profiles } = await useAsyncData('inbox-profiles', async () => {
  if (!conversations.value?.length) return {}
  const ids = [...new Set(conversations.value.flatMap(c => [c.initiator_id, c.recipient_id]))]
  const { data } = await supabase.from('profiles').select('id, name').in('id', ids)
  const map = {}
  data?.forEach(p => { map[p.id] = p.name })
  return map
})

const { data: messageMeta, refresh: refreshMeta } = await useAsyncData('message-meta', async () => {
  if (!conversations.value?.length) return {}
  const convIds = conversations.value.map(c => c.id)
  const { data } = await supabase
    .from('messages')
    .select('conversation_id, body, created_at, sender_id, read')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  const meta = {}
  data?.forEach(msg => {
    if (!meta[msg.conversation_id]) {
      meta[msg.conversation_id] = { lastMessage: msg.body, lastAt: msg.created_at, unread: 0 }
    }
    if (!msg.read && msg.sender_id !== user.id) {
      meta[msg.conversation_id].unread++
    }
  })
  return meta
}, { default: () => ({}) })

const timeAgo = (date) => {
  const diff = Math.floor((new Date() - new Date(date)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(date).toLocaleDateString('en-KE')
}

const router = useRouter()
const route = useRoute()
const activeConversationId = ref(route.query.id ? parseInt(route.query.id) : null)

const openConversation = (id) => {
  activeConversationId.value = id
  router.replace({ query: { id } })
}

const activeConversation = computed(() =>
  conversations.value?.find(c => c.id === activeConversationId.value) ?? null
)

// Poll for new messages in the inbox list every 5 seconds
onMounted(() => {
  const interval = setInterval(() => {
    refresh()
    refreshMeta()
  }, 5000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <div class="bg-gray-100 min-h-screen py-8">
    <div class="max-w-5xl mx-auto px-4">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">Messages</h1>

      <div v-if="conversations.length === 0" class="bg-white rounded-2xl p-20 text-center shadow-sm">
        <div class="text-5xl mb-4">💬</div>
        <p class="text-gray-500 font-semibold">No conversations yet</p>
        <p class="text-gray-400 text-sm mt-1">Start a conversation from any listing page</p>
      </div>

      <div v-else class="bg-white rounded-2xl shadow-sm overflow-hidden flex" style="min-height: 560px;">

        <div class="w-full md:w-80 border-r shrink-0 overflow-y-auto">
          <div v-for="conv in conversations" :key="conv.id" @click="openConversation(conv.id)"
            class="flex gap-3 px-4 py-4 border-b cursor-pointer hover:bg-gray-50 transition"
            :class="activeConversationId === conv.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''">

            <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100">
              <img v-if="conv.products?.image_url" :src="conv.products.image_url" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-xl">🌾</div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start">
                <p class="font-semibold text-gray-800 text-sm truncate">{{ conv.products?.title }}</p>
                <span class="text-xs text-gray-400 shrink-0 ml-2">
                  {{ messageMeta?.[conv.id] ? timeAgo(messageMeta[conv.id].lastAt) : timeAgo(conv.created_at) }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                with {{ profiles?.[conv.initiator_id === user.id ? conv.recipient_id : conv.initiator_id] ?? 'User' }}
              </p>
              <div class="flex justify-between items-center mt-1">
                <p class="text-xs text-gray-400 truncate">
                  {{ messageMeta?.[conv.id]?.lastMessage ?? 'No messages yet' }}
                </p>
                <span v-if="messageMeta?.[conv.id]?.unread > 0"
                  class="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 ml-2 font-bold">
                  {{ messageMeta[conv.id].unread }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 flex items-center justify-center text-gray-400 text-sm" v-if="!activeConversation">
          <div class="text-center">
            <div class="text-4xl mb-2">👈</div>
            Select a conversation
          </div>
        </div>

        <MessageDrawer v-else :conversation="activeConversation" :user="user" :inline="true" />

      </div>
    </div>
  </div>
</template>