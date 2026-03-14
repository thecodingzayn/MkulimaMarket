<script setup>
definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const searchQuery = ref('')
const activeTab = ref('all') // all | unread | spam

const { data: conversations, refresh } = await useAsyncData('conversations', async () => {
  const { data, error } = await supabase
    .from('conversations')
    .select(`id, created_at, listing_id, initiator_id, recipient_id, products(id, title, image_url)`)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
  if (error) console.error('conversations error:', error)
  return data ?? []
})

const { data: profiles } = await useAsyncData('inbox-profiles', async () => {
  if (!conversations.value?.length) return {}
  const ids = [...new Set(conversations.value.flatMap(c => [c.initiator_id, c.recipient_id]))]
  const { data } = await supabase.from('profiles').select('id, name, avatar_url').in('id', ids)
  const map = {}
  data?.forEach(p => { map[p.id] = { name: p.name, avatar_url: p.avatar_url } })
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

const otherPersonId = (conv) =>
  conv.initiator_id === user.id ? conv.recipient_id : conv.initiator_id

const otherPerson = (conv) => profiles.value?.[otherPersonId(conv)]

const filteredConversations = computed(() => {
  let list = conversations.value ?? []

  if (activeTab.value === 'unread') {
    list = list.filter(c => (messageMeta.value?.[c.id]?.unread ?? 0) > 0)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      conv.products?.title?.toLowerCase().includes(q) ||
      otherPerson(c)?.name?.toLowerCase().includes(q)
    )
  }

  return list
})

const formatTime = (date) => {
  if (!date || !process.client) return ''
  const d = new Date(date)
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
const smartDate = (date) => {
  if (!date) return ''
  const now = new Date()
  const d = new Date(date)

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return formatTime(date)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return d.toLocaleDateString('en-KE', { weekday: 'long' })
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
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

const unreadCount = computed(() =>
  Object.values(messageMeta.value ?? {}).filter(m => m.unread > 0).length
)

onMounted(() => {
  const interval = setInterval(() => { refresh(); refreshMeta() }, 5000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <div class="bg-gray-100 min-h-screen">
    <div class="max-w-6xl mx-auto px-4 py-8">

      <div v-if="conversations?.length" class="bg-white rounded-2xl p-20 text-center shadow-sm">
        <div class="text-5xl mb-4">💬</div>
        <p class="text-gray-500 font-semibold">No conversations yet</p>
        <p class="text-gray-400 text-sm mt-1">Start a conversation from any listing page</p>
      </div>

      <div v-else class="bg-white rounded-2xl shadow-sm overflow-hidden flex" style="min-height: 600px;">

        <!-- Left panel -->
        <div class="w-80 shrink-0 border-r flex flex-col">

          <!-- Header -->
          <div class="px-5 py-4 border-b">
            <h2 class="text-lg font-bold text-gray-800">My messages</h2>
          </div>

          <!-- Search -->
          <div class="px-4 py-3 border-b">
            <div class="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <span class="text-gray-400 text-sm">🔍</span>
              <input v-model="searchQuery" type="text" placeholder="Search"
                class="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400" />
            </div>
          </div>

          <!-- Tabs -->
          <div class="flex border-b">
            <button v-for="tab in ['all', 'unread', 'spam']" :key="tab"
              @click="activeTab = tab"
              class="flex-1 py-3 text-sm font-medium capitalize transition border-b-2"
              :class="activeTab === tab
                ? 'text-green-600 border-green-500'
                : 'text-gray-400 border-transparent hover:text-gray-600'">
              {{ tab }}
              <span v-if="tab === 'unread' && unreadCount > 0"
                class="ml-1 bg-green-500 text-white text-xs rounded-full px-1.5">
                {{ unreadCount }}
              </span>
            </button>
          </div>

          <!-- Conversation list -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="filteredConversations.length === 0" class="py-16 text-center text-gray-400 text-sm">
              No conversations found
            </div>

            <div v-for="conv in filteredConversations" :key="conv.id"
              @click="openConversation(conv.id)"
              class="flex gap-3 px-4 py-3.5 border-b cursor-pointer hover:bg-gray-50 transition relative"
              :class="activeConversationId === conv.id ? 'bg-green-50 border-l-4 border-l-green-500' : 'border-l-4 border-l-transparent'">

              <!-- Avatar -->
              <div class="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-green-100 flex items-center justify-center text-lg font-bold text-green-600">
                <img v-if="otherPerson(conv)?.avatar_url" :src="otherPerson(conv).avatar_url" class="w-full h-full object-cover" />
                <span v-else>{{ otherPerson(conv)?.name?.[0]?.toUpperCase() ?? '?' }}</span>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                  <p class="font-semibold text-gray-800 text-sm truncate">
                    {{ otherPerson(conv)?.name ?? 'User' }}
                  </p>
                  <span class="text-xs text-gray-400 shrink-0 ml-2">
                    {{ smartDate(messageMeta?.[conv.id]?.lastAt ?? conv.created_at) }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 truncate mt-0.5">{{ conv.products?.title }}</p>
                <div class="flex justify-between items-center mt-0.5">
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
        </div>

        <!-- Right panel -->
        <div class="flex-1 flex flex-col">

          <!-- No conversation selected -->
          <div v-if="!activeConversation" class="flex-1 flex items-center justify-center">
            <div class="text-center text-gray-400">
              <div class="text-5xl mb-3">💬</div>
              <p class="font-medium text-gray-500">Select a conversation</p>
              <p class="text-sm mt-1">Choose from your messages on the left</p>
            </div>
          </div>

          <!-- Active conversation -->
          <template v-else>
            <!-- Conversation header -->
            <div class="flex items-center gap-3 px-6 py-4 border-b">
              <div class="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-green-100 flex items-center justify-center text-lg font-bold text-green-600">
                <img v-if="otherPerson(activeConversation)?.avatar_url"
                  :src="otherPerson(activeConversation).avatar_url" class="w-full h-full object-cover" />
                <span v-else>{{ otherPerson(activeConversation)?.name?.[0]?.toUpperCase() ?? '?' }}</span>
              </div>
              <div class="flex-1">
                <p class="font-bold text-gray-800">{{ otherPerson(activeConversation)?.name ?? 'User' }}</p>
                <p class="text-xs text-green-600 truncate">{{ activeConversation.products?.title }}</p>
              </div>
              <!-- Listing thumbnail -->
              <div v-if="activeConversation.products?.image_url"
                class="w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                <img :src="activeConversation.products.image_url" class="w-full h-full object-cover" />
              </div>
            </div>

            <!-- Messages -->
            <MessageDrawer :conversation="activeConversation" :user="user" :inline="true" />
          </template>

        </div>
      </div>
    </div>
  </div>
</template>