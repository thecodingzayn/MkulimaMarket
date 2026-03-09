<script setup>
const props = defineProps({
  conversation: Object,
  listing: Object,
  user: Object,
  otherUserId: String,
  inline: Boolean,
  modelValue: Boolean,
})

const emit = defineEmits(['update:modelValue', 'conversationStarted'])

const supabase = useSupabaseClient()

const messages = ref([])
const newMessage = ref('')
const sending = ref(false)
const messagesEl = ref(null)
const activeConversation = ref(props.conversation ?? null)
let pollInterval = null

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

const markAsRead = async () => {
  if (!activeConversation.value || !props.user?.id) return
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', activeConversation.value.id)
    .neq('sender_id', props.user.id)
    .eq('read', false)
}

const loadMessages = async () => {
  if (!activeConversation.value) return
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', activeConversation.value.id)
    .order('created_at', { ascending: true })
  messages.value = data ?? []
  await scrollToBottom()
  await markAsRead()
}

const cleanup = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

const subscribeToMessages = () => {
  if (!activeConversation.value) return
  cleanup()

  pollInterval = setInterval(async () => {
    if (!activeConversation.value) return

    const lastId = messages.value.length > 0
      ? Math.max(...messages.value.map(m => m.id))
      : 0

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeConversation.value.id)
      .gt('id', lastId)
      .order('created_at', { ascending: true })

    if (data?.length) {
      messages.value.push(...data)
      await scrollToBottom()
      if (data.some(m => m.sender_id !== props.user?.id)) markAsRead()
    }
  }, 2000)
}

const initConversation = async () => {
  if (!props.user?.id) return

  // Try to find existing conversation in both directions
  let existing = null

  const { data: asInitiator } = await supabase
    .from('conversations')
    .select('*')
    .eq('listing_id', props.listing.id)
    .eq('initiator_id', props.user.id)
    .eq('recipient_id', props.otherUserId)
    .maybeSingle()

  if (asInitiator) {
    existing = asInitiator
  } else {
    const { data: asRecipient } = await supabase
      .from('conversations')
      .select('*')
      .eq('listing_id', props.listing.id)
      .eq('initiator_id', props.otherUserId)
      .eq('recipient_id', props.user.id)
      .maybeSingle()
    existing = asRecipient
  }

  if (existing) {
    activeConversation.value = existing
  } else {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({
        listing_id: props.listing.id,
        initiator_id: props.user.id,
        recipient_id: props.otherUserId,
      })
      .select()
      .single()

    if (error) {
      console.error('Conversation create error:', error)
      return
    }
    activeConversation.value = created
    emit('conversationStarted', created)
  }

  await loadMessages()
  subscribeToMessages()
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || sending.value) return
  sending.value = true

  const body = newMessage.value.trim()
  newMessage.value = ''

  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: activeConversation.value.id,
      sender_id: props.user.id,
      body,
    })

  if (error) {
    console.error('Send error:', error)
    newMessage.value = body
  }

  sending.value = false
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const close = () => emit('update:modelValue', false)

// Drawer mode — triggers when drawer opens/closes
watch(() => props.modelValue, async (val) => {
  if (val) {
    await initConversation()
  } else {
    cleanup()
    if (!props.inline) {
      activeConversation.value = null
      messages.value = []
    }
  }
})

// Inline mode — triggers when user clicks a conversation in the inbox
watch(() => props.conversation, async (val) => {
  if (val) {
    cleanup()
    activeConversation.value = val
    await loadMessages()
    subscribeToMessages()
  }
}, { immediate: true })  // ← immediate:true starts polling on mount too

onUnmounted(() => cleanup())

const otherName = computed(() => {
  if (!activeConversation.value) return ''
  if (props.inline) {
    const isInitiator = activeConversation.value.initiator_id === props.user?.id
    return isInitiator
      ? activeConversation.value.recipient?.name
      : activeConversation.value.initiator?.name
  }
  return props.listing?.profiles?.name ?? 'User'
})

const timeStr = (date) => new Date(date).toLocaleTimeString('en-KE', {
  hour: '2-digit', minute: '2-digit'
})
</script>

<template>
  <!-- INLINE MODE -->
  <div v-if="inline" class="flex flex-col flex-1 h-full">
    <div class="px-5 py-4 border-b flex items-center gap-3">
      <div class="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-lg">👤</div>
      <div>
        <p class="font-semibold text-gray-800 text-sm">{{ otherName }}</p>
        <NuxtLink :to="`/listings/${activeConversation.listing_id}`" class="text-xs text-green-600 hover:underline">
          {{ activeConversation.products?.title ?? 'View listing' }}
        </NuxtLink>
      </div>
    </div>

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <div v-if="messages.length === 0" class="text-center text-gray-400 text-sm py-10">
        No messages yet. Say hello! 👋
      </div>
      <div v-for="msg in messages" :key="msg.id" class="flex"
        :class="msg.sender_id === user.id ? 'justify-end' : 'justify-start'">
        <div class="max-w-xs px-4 py-2 rounded-2xl text-sm"
          :class="msg.sender_id === user.id ? 'bg-green-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'">
          <p>{{ msg.body }}</p>
          <p class="text-xs mt-1 opacity-60 text-right">{{ timeStr(msg.created_at) }}</p>
        </div>
      </div>
    </div>

    <div class="px-4 py-3 border-t flex gap-2">
      <textarea v-model="newMessage" @keydown="handleKeydown" rows="1" placeholder="Type a message..."
        class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
      <button @click="sendMessage" :disabled="!newMessage.trim() || sending"
        class="w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0"
        :class="newMessage.trim() ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-100 text-gray-300'">
        ➤
      </button>
    </div>
  </div>

  <!-- DRAWER MODE -->
  <Teleport to="body" v-else>
    <Transition name="drawer">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black bg-opacity-40" @click="close" />
        <div class="relative w-full max-w-sm bg-white flex flex-col shadow-2xl h-full">

          <div class="bg-green-600 text-white px-5 py-4 flex items-center gap-3">
            <button @click="close" class="hover:bg-green-700 rounded-lg p-1 transition">✕</button>
            <div class="w-9 h-9 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-lg">👤</div>
            <div>
              <p class="font-semibold text-sm">{{ otherName }}</p>
              <p class="text-xs text-green-200 truncate max-w-48">{{ listing?.title }}</p>
            </div>
          </div>

          <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            <div v-if="messages.length === 0" class="text-center text-gray-400 text-sm py-10">
              No messages yet. Say hello! 👋
            </div>
            <div v-for="msg in messages" :key="msg.id" class="flex"
              :class="msg.sender_id === user.id ? 'justify-end' : 'justify-start'">
              <div class="max-w-xs px-4 py-2 rounded-2xl text-sm"
                :class="msg.sender_id === user.id ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'">
                <p>{{ msg.body }}</p>
                <p class="text-xs mt-1 opacity-60 text-right">{{ timeStr(msg.created_at) }}</p>
              </div>
            </div>
          </div>

          <div class="px-4 py-3 border-t bg-white flex gap-2">
            <textarea v-model="newMessage" @keydown="handleKeydown" rows="1" placeholder="Type a message..."
              class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button @click="sendMessage" :disabled="!newMessage.trim() || sending"
              class="w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0"
              :class="newMessage.trim() ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-100 text-gray-300'">
              ➤
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: all 0.3s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from > div:last-child, .drawer-leave-to > div:last-child { transform: translateX(100%); }
</style>