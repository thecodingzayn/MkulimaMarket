<script setup>
import { Icon } from '@iconify/vue'

definePageMeta({ middleware: ['auth', 'no-admin'] })

const supabase = useSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()

const searchQuery = ref('')
const activeTab = ref('all')
const loading = ref(true)

const conversations = ref([])
const profiles = ref({})
const messageMeta = ref({})

const loadAll = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('conversations')
    .select(`id, created_at, listing_id, initiator_id, recipient_id, is_spam, initiator_spam, recipient_spam, products(id, title, price, user_id, listing_images(id, url, position))`)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) console.error('conversations error:', error)
  conversations.value = data ?? []

  if (conversations.value.length) {
    // Load profiles
    const ids = [...new Set(conversations.value.flatMap(c => [c.initiator_id, c.recipient_id]))]
    const { data: profilesData } = await supabase.from('profiles').select('id, name, avatar_url, phone').in('id', ids)
    const map = {}
    profilesData?.forEach(p => { map[p.id] = { name: p.name, avatar_url: p.avatar_url, phone: p.phone } })
    profiles.value = map

    // Load message meta
    const convIds = conversations.value.map(c => c.id)
    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, body, created_at, sender_id, read')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    const meta = {}
    messages?.forEach(msg => {
      if (!meta[msg.conversation_id]) {
        meta[msg.conversation_id] = {
          lastMessage: msg.body,
          lastAt: msg.created_at,
          lastSenderId: msg.sender_id,
          lastRead: msg.read,
          unread: 0
        }
      }
      if (!msg.read && msg.sender_id !== user.id) {
        meta[msg.conversation_id].unread++
      }
    })
    messageMeta.value = meta
  }

  loading.value = false
}

const refresh = async () => {
  const { data, error } = await supabase
    .from('conversations')
    .select(`id, created_at, listing_id, initiator_id, recipient_id, is_spam, initiator_spam, recipient_spam, products(id, title, price, user_id, listing_images(id, url, position))`)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
  if (!error) conversations.value = data ?? []
}

const refreshMeta = async () => {
  if (!conversations.value.length) return
  const convIds = conversations.value.map(c => c.id)
  const { data: messages } = await supabase
    .from('messages')
    .select('conversation_id, body, created_at, sender_id, read')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  const meta = {}
  messages?.forEach(msg => {
    if (!meta[msg.conversation_id]) {
      meta[msg.conversation_id] = {
        lastMessage: msg.body,
        lastAt: msg.created_at,
        lastSenderId: msg.sender_id,
        lastRead: msg.read,
        unread: 0
      }
    }
    if (!msg.read && msg.sender_id !== user.id) {
      meta[msg.conversation_id].unread++
    }
  })
  messageMeta.value = meta
}

onMounted(async () => {
  await loadAll()

  const interval = setInterval(() => { refresh(); refreshMeta() }, 5000)
  onUnmounted(() => clearInterval(interval))

  const closeMenu = () => { showMenu.value = false }
  document.addEventListener('click', closeMenu)
  onUnmounted(() => document.removeEventListener('click', closeMenu))
})

const otherPersonId = (conv) =>
  conv.initiator_id === user.id ? conv.recipient_id : conv.initiator_id

const otherPerson = (conv) => profiles.value?.[otherPersonId(conv)]

const isSpamForMe = (conv) => {
  if (!conv) return false
  if (conv.initiator_id === user.id) return conv.initiator_spam ?? false
  return conv.recipient_spam ?? false
}

const filteredConversations = computed(() => {
  let list = [...(conversations.value ?? [])]

  if (activeTab.value === 'spam') {
    list = list.filter(c => isSpamForMe(c))
  } else {
    list = list.filter(c => !isSpamForMe(c))
  }

  if (activeTab.value === 'unread') {
    list = list.filter(c => (messageMeta.value?.[c.id]?.unread ?? 0) > 0)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.products?.title?.toLowerCase().includes(q) ||
      otherPerson(c)?.name?.toLowerCase().includes(q)
    )
  }

  list.sort((a, b) => {
    const aTime = messageMeta.value?.[a.id]?.lastAt ?? a.created_at
    const bTime = messageMeta.value?.[b.id]?.lastAt ?? b.created_at
    return new Date(bTime) - new Date(aTime)
  })

  return list
})

const toNairobi = (date) => {
  const utcMs = new Date(date).getTime()
  const nairobiMs = utcMs + (3 * 60 * 60 * 1000)
  return new Date(nairobiMs)
}

const formatTime = (date) => {
  if (!date || !process.client) return ''
  const d = toNairobi(date)
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes} ${ampm}`
}

const smartDate = (date) => {
  if (!date || !process.client) return ''
  const nairobiDate = toNairobi(date)
  const nowNairobi = toNairobi(new Date().toISOString())
  const todayMidnight = new Date(nowNairobi.getFullYear(), nowNairobi.getMonth(), nowNairobi.getDate())
  const msgMidnight = new Date(nairobiDate.getFullYear(), nairobiDate.getMonth(), nairobiDate.getDate())
  const diffDays = Math.round((todayMidnight - msgMidnight) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return formatTime(date)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return nairobiDate.toLocaleDateString('en-KE', { weekday: 'long' })
  return nairobiDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const toggleSpam = async (conv) => {
  if (!conv) return
  const isInitiator = conv.initiator_id === user.id
  const spamField = isInitiator ? 'initiator_spam' : 'recipient_spam'
  const currentValue = isSpamForMe(conv)

  const { error } = await supabase
    .from('conversations')
    .update({ [spamField]: !currentValue })
    .eq('id', conv.id)
    .select()

  if (!error && !currentValue) {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', user.id)
  }

  if (!error) {
    await refresh()
    await refreshMeta()
    if (!currentValue) {
      activeConversationId.value = null
      router.replace({ query: {} })
    }
  }
}

const deleteConversation = async (conv) => {
  if (!confirm('Delete this conversation? This cannot be undone.')) return
  await supabase.from('conversations').delete().eq('id', conv.id)
  activeConversationId.value = null
  showMenu.value = false
  showChatOnMobile.value = false
  router.replace({ query: {} })
  await refresh()
}

const router = useRouter()
const route = useRoute()
const activeConversationId = ref(route.query.id ? parseInt(route.query.id) : null)
const showContact = ref(false)
const showMenu = ref(false)
const showChatOnMobile = ref(!!route.query.id)

const openConversation = (id) => {
  activeConversationId.value = id
  showContact.value = false
  showMenu.value = false
  contactViewedAt.value = null
  showChatOnMobile.value = true
  router.replace({ query: { id } })
}

const backToList = () => {
  showChatOnMobile.value = false
  activeConversationId.value = null
  router.replace({ query: {} })
}

const contactViewedAt = ref(null)

const revealContact = () => {
  showContact.value = true
  const d = new Date()
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  contactViewedAt.value = `${h}:${minutes} ${ampm}`
}

const activeConversation = computed(() =>
  conversations.value?.find(c => c.id === activeConversationId.value) ?? null
)

const unreadCount = computed(() =>
  (conversations.value ?? []).filter(c =>
    !isSpamForMe(c) && (messageMeta.value?.[c.id]?.unread ?? 0) > 0
  ).length
)

const spamCount = computed(() =>
  (conversations.value ?? []).filter(c =>
    isSpamForMe(c) && (messageMeta.value?.[c.id]?.unread ?? 0) > 0
  ).length
)
</script>

<template>
  <div class="bg-gray-100 min-h-screen">
    <div class="max-w-6xl mx-auto px-0 md:px-4 py-0 md:py-8">

      <!-- Loading skeleton -->
      <div v-if="loading"
        class="bg-white md:rounded-2xl shadow-sm overflow-hidden flex h-screen md:h-auto md:min-h-[600px]">

        <!-- Left panel skeleton -->
        <div class="w-full md:w-80 md:shrink-0 flex flex-col border-r">
          <!-- Header -->
          <div class="px-4 md:px-5 py-3 md:py-4 border-b">
            <div class="h-5 bg-gray-200 rounded-full w-32 animate-pulse"></div>
          </div>
          <!-- Search -->
          <div class="px-3 md:px-4 py-2.5 md:py-3 border-b">
            <div class="h-9 bg-gray-200 rounded-xl animate-pulse"></div>
          </div>
          <!-- Tabs -->
          <div class="flex border-b">
            <div v-for="n in 3" :key="n" class="flex-1 py-3 flex justify-center">
              <div class="h-4 bg-gray-200 rounded-full w-12 animate-pulse"></div>
            </div>
          </div>
          <!-- Conversation skeletons -->
          <div class="flex-1 overflow-y-auto divide-y">
            <div v-for="n in 6" :key="n"
              class="flex gap-3 px-3 md:px-4 py-3 md:py-3.5 animate-pulse">
              <!-- Image -->
              <div class="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-gray-200 shrink-0"></div>
              <!-- Info -->
              <div class="flex-1 min-w-0 space-y-2 py-1">
                <div class="flex justify-between">
                  <div class="h-3.5 bg-gray-200 rounded-full w-28"></div>
                  <div class="h-3 bg-gray-200 rounded-full w-10"></div>
                </div>
                <div class="h-3 bg-gray-200 rounded-full w-36"></div>
                <div class="h-3 bg-gray-200 rounded-full w-44"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right panel skeleton — desktop only -->
        <div class="hidden md:flex flex-1 items-center justify-center">
          <div class="text-center text-gray-300 animate-pulse">
            <Icon icon="mdi:message-outline" class="w-16 h-16 mx-auto mb-3" />
            <div class="h-4 bg-gray-200 rounded-full w-40 mx-auto mb-2"></div>
            <div class="h-3 bg-gray-200 rounded-full w-56 mx-auto"></div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!conversations?.length"
        class="bg-white rounded-2xl p-12 md:p-20 text-center shadow-sm mx-3 my-4 md:mx-0 md:my-0">
        <Icon icon="mdi:message-outline" class="w-14 h-14 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500 font-semibold text-sm md:text-base">No conversations yet</p>
        <p class="text-gray-400 text-xs md:text-sm mt-1">Start a conversation from any listing page</p>
      </div>

      <!-- Inbox -->
      <div v-else
        class="bg-white md:rounded-2xl shadow-sm overflow-hidden flex h-screen md:h-auto md:min-h-[600px]">

        <!-- LEFT PANEL -->
        <div
          class="flex flex-col border-r"
          :class="[
            showChatOnMobile ? 'hidden md:flex' : 'flex',
            'w-full md:w-80 md:shrink-0'
          ]">

          <!-- Header -->
          <div class="px-4 md:px-5 py-3 md:py-4 border-b">
            <h2 class="text-base md:text-lg font-bold text-gray-800">My messages</h2>
          </div>

          <!-- Search -->
          <div class="px-3 md:px-4 py-2.5 md:py-3 border-b">
            <div class="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <Icon icon="mdi:magnify" class="w-4 h-4 text-gray-400 shrink-0" />
              <input v-model="searchQuery" type="text" placeholder="Search"
                class="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400" />
            </div>
          </div>

          <!-- Tabs -->
          <div class="flex border-b">
            <button v-for="tab in ['all', 'unread', 'spam']" :key="tab"
              @click="activeTab = tab"
              class="flex-1 py-2.5 md:py-3 text-xs md:text-sm font-medium capitalize transition border-b-2"
              :class="activeTab === tab
                ? 'text-green-600 border-green-500'
                : 'text-gray-400 border-transparent hover:text-gray-600'">
              {{ tab }}
              <span v-if="tab === 'unread' && unreadCount > 0"
                class="ml-1 bg-green-500 text-white text-xs rounded-full px-1.5">
                {{ unreadCount }}
              </span>
              <span v-if="tab === 'spam' && spamCount > 0"
                class="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">
                {{ spamCount }}
              </span>
            </button>
          </div>

          <!-- Conversation list -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="filteredConversations.length === 0"
              class="py-12 md:py-16 text-center text-gray-400 text-sm">
              No conversations found
            </div>

            <div v-for="conv in filteredConversations" :key="conv.id"
              @click="openConversation(conv.id)"
              class="flex gap-3 px-3 md:px-4 py-3 md:py-3.5 border-b cursor-pointer hover:bg-gray-50 transition"
              :class="[
                activeConversationId === conv.id
                  ? 'bg-green-50 border-l-4 border-l-green-500'
                  : 'border-l-4 border-l-transparent',
                isSpamForMe(conv) ? 'opacity-60' : ''
              ]">

              <div class="w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                <img v-if="conv.products?.listing_images?.length"
                  :src="[...conv.products.listing_images].sort((a,b) => a.position - b.position)[0]?.url"
                  class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center bg-green-50">
                  <Icon icon="mdi:sprout" class="w-6 h-6 text-green-400" />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                  <p class="font-semibold text-gray-800 text-sm truncate">
                    {{ otherPerson(conv)?.name ?? 'User' }}
                  </p>
                  <span class="text-xs text-gray-400 shrink-0 ml-2">
                    {{ smartDate(messageMeta?.[conv.id]?.lastAt ?? conv.created_at) }}
                  </span>
                </div>
                <p class="text-xs text-green-600 font-medium truncate mt-0.5">
                  {{ conv.products?.title }}
                </p>

                <div class="flex justify-between items-center mt-0.5">
                  <div class="flex items-center gap-1 min-w-0 flex-1">
                    <span v-if="messageMeta?.[conv.id]?.lastSenderId === user.id" class="shrink-0">
                      <svg v-if="!messageMeta?.[conv.id]?.lastRead"
                        class="w-5 h-3.5" viewBox="0 0 22 11" fill="none">
                        <path d="M1 5.5L5.5 10L15 1" stroke="#9CA3AF" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 5.5L11.5 10L21 1" stroke="#9CA3AF" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <svg v-else class="w-5 h-3.5" viewBox="0 0 22 11" fill="none">
                        <path d="M1 5.5L5.5 10L15 1" stroke="#22c55e" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M7 5.5L11.5 10L21 1" stroke="#22c55e" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <p class="text-xs text-gray-400 truncate">
                      {{ messageMeta?.[conv.id]?.lastMessage ?? 'No messages yet' }}
                    </p>
                  </div>
                  <span v-if="messageMeta?.[conv.id]?.unread > 0"
                    class="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 ml-2 font-bold">
                    {{ messageMeta[conv.id].unread }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT PANEL -->
        <div
          class="flex-1 flex flex-col min-w-0"
          :class="showChatOnMobile ? 'flex' : 'hidden md:flex'">

          <div v-if="!activeConversation"
            class="flex-1 flex items-center justify-center">
            <div class="text-center text-gray-400">
              <Icon icon="mdi:message-outline" class="w-14 h-14 md:w-16 md:h-16 text-gray-300 mx-auto mb-3" />
              <p class="font-medium text-gray-500 text-sm md:text-base">Select a conversation</p>
              <p class="text-xs md:text-sm mt-1">Choose from your messages on the left</p>
            </div>
          </div>

          <template v-else>

            <div class="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2.5 md:py-3 border-b bg-white">
              <button @click="backToList"
                class="md:hidden w-8 h-8 flex items-center justify-center text-gray-500 hover:text-green-600 transition shrink-0">
                <Icon icon="mdi:arrow-left" class="w-5 h-5" />
              </button>

              <div class="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 bg-green-100 flex items-center justify-center text-sm font-bold text-green-600">
                <img v-if="otherPerson(activeConversation)?.avatar_url"
                  :src="otherPerson(activeConversation).avatar_url"
                  class="w-full h-full object-cover" />
                <span v-else>
                  {{ otherPerson(activeConversation)?.name?.[0]?.toUpperCase() ?? '?' }}
                </span>
              </div>

              <p class="font-bold text-gray-800 flex-1 truncate text-sm md:text-base">
                {{ otherPerson(activeConversation)?.name ?? 'User' }}
              </p>

              <div class="relative">
                <button @click.stop="showMenu = !showMenu"
                  class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition text-gray-500">
                  <Icon icon="mdi:dots-vertical" class="w-5 h-5" />
                </button>
                <div v-if="showMenu"
                  class="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 w-48 md:w-52 z-50 overflow-hidden">
                  <NuxtLink :to="`/listings/${activeConversation.listing_id}`"
                    @click="showMenu = false"
                    class="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition">
                    <Icon icon="mdi:open-in-new" class="w-4 h-4" />View listing
                  </NuxtLink>
                  <button @click.stop="toggleSpam(activeConversation); showMenu = false"
                    class="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition">
                    <Icon icon="mdi:alert-circle-outline" class="w-4 h-4" />
                    {{ isSpamForMe(activeConversation) ? 'Remove from spam' : 'Move to spam' }}
                  </button>
                  <button @click.stop="deleteConversation(activeConversation)"
                    class="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition">
                    <Icon icon="mdi:delete-outline" class="w-4 h-4" />Delete chat
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-b">
              <div class="w-10 h-9 md:w-12 md:h-10 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                <img v-if="activeConversation.products?.listing_images?.length"
                  :src="[...activeConversation.products.listing_images].sort((a,b) => a.position - b.position)[0]?.url"
                  class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Icon icon="mdi:sprout" class="w-5 h-5 text-gray-400" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs md:text-sm font-semibold text-gray-800 truncate">
                  {{ activeConversation.products?.title }}
                </p>
                <p class="text-xs md:text-sm font-bold text-green-600">
                  KSh {{ Number(activeConversation.products?.price).toLocaleString('en-KE') }}
                </p>
              </div>
              <div class="shrink-0">
                <button v-if="!showContact" @click="revealContact"
                  class="flex items-center gap-1 md:gap-2 border border-green-500 text-green-600 hover:bg-green-50 text-xs md:text-sm font-semibold px-2.5 md:px-4 py-1.5 md:py-2 rounded-xl transition">
                  <Icon icon="mdi:phone-outline" class="w-4 h-4" />
                  <span class="hidden sm:inline">Show</span> contact
                </button>
                <a v-else :href="`tel:${otherPerson(activeConversation)?.phone}`"
                  class="flex items-center gap-1 md:gap-2 bg-green-500 hover:bg-green-600 text-white text-xs md:text-sm font-semibold px-2.5 md:px-4 py-1.5 md:py-2 rounded-xl transition">
                  <Icon icon="mdi:phone" class="w-4 h-4" />
                  <span class="hidden sm:inline">{{ otherPerson(activeConversation)?.phone ?? 'No phone' }}</span>
                  <span class="sm:hidden">Call</span>
                </a>
              </div>
            </div>

            <MessageDrawer
              :conversation="activeConversation"
              :user="user"
              :inline="true"
              :is-spam="isSpamForMe(activeConversation)"
              :contact-viewed-at="contactViewedAt"
              :contact-name="otherPerson(activeConversation)?.name" />

          </template>
        </div>
      </div>
    </div>
  </div>
</template>