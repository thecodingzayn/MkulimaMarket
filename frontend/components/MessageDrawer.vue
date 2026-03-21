<script setup>
import { Icon } from '@iconify/vue'
const props = defineProps({
  conversation: Object,
  listing: Object,
  user: Object,
  otherUserId: String,
  inline: Boolean,
  modelValue: Boolean,
  isSpam: { type: Boolean, default: false },
  contactViewedAt: { type: String, default: null },
  contactName: { type: String, default: null }
})

const emit = defineEmits(['update:modelValue', 'conversationStarted'])

const supabase = useSupabaseClient()

const messages = ref([])
const newMessage = ref('')
const sending = ref(false)
const messagesEl = ref(null)
const activeConversation = ref(props.conversation ?? null)
let pollInterval = null

const quickReplies = ['Last price', 'Is this available?', 'Ask for location', 'Make an offer', 'Please call me']

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
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

const subscribeToMessages = () => {
  if (!activeConversation.value) return
  cleanup()
  pollInterval = setInterval(async () => {
    if (!activeConversation.value) return
    const lastId = messages.value.length > 0
      ? Math.max(...messages.value.map(m => m.id)) : 0

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeConversation.value.id)
      .order('created_at', { ascending: true })

    if (data) {
      messages.value = data
      const hasNew = data.some(m => m.id > lastId)
      if (hasNew) {
        await scrollToBottom()
        if (data.some(m => m.sender_id !== props.user?.id && !m.read)) markAsRead()
      }
    }
  }, 2000)
}

const initConversation = async () => {
  if (!props.user?.id) return
  let existing = null
  const { data: asInitiator } = await supabase
    .from('conversations').select('*')
    .eq('listing_id', props.listing.id)
    .eq('initiator_id', props.user.id)
    .eq('recipient_id', props.otherUserId)
    .maybeSingle()
  if (asInitiator) {
    existing = asInitiator
  } else {
    const { data: asRecipient } = await supabase
      .from('conversations').select('*')
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
      .select().single()
    if (error) { console.error('Conversation create error:', error); return }
    activeConversation.value = created
    emit('conversationStarted', created)
  }
  await loadMessages()
  subscribeToMessages()
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || sending.value || props.isSpam) return
  sending.value = true
  const body = newMessage.value.trim()
  newMessage.value = ''
  const { error } = await supabase.from('messages').insert({
    conversation_id: activeConversation.value.id,
    sender_id: props.user.id,
    body,
    created_at: new Date().toISOString()
  })
  if (error) { console.error('Send error:', error); newMessage.value = body }
  sending.value = false
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

const useQuickReply = (text) => { newMessage.value = text }
const close = () => emit('update:modelValue', false)

watch(() => props.modelValue, async (val) => {
  if (val) {
    await initConversation()
  } else {
    cleanup()
    if (!props.inline) { activeConversation.value = null; messages.value = [] }
  }
})

watch(() => props.conversation, async (val) => {
  if (val) {
    cleanup()
    activeConversation.value = val
    await loadMessages()
    subscribeToMessages()
  }
}, { immediate: true })

onUnmounted(() => cleanup())

const toNairobi = (date) => {
  const utcMs = new Date(date).getTime()
  const nairobiMs = utcMs + (3 * 60 * 60 * 1000)
  return new Date(nairobiMs)
}

// For Supabase UTC timestamps — adds 3 hours
const timeStr = (date) => {
  if (!date || !process.client) return ''
  const d = toNairobi(date)
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes} ${ampm}`
}

const groupedMessages = computed(() => {
  const groups = []
  let lastLabel = null

  for (const msg of messages.value) {
    const nairobiDate = toNairobi(msg.created_at)
    const nowNairobi = toNairobi(new Date().toISOString())

    const todayMidnight = new Date(nowNairobi.getFullYear(), nowNairobi.getMonth(), nowNairobi.getDate())
    const msgMidnight = new Date(nairobiDate.getFullYear(), nairobiDate.getMonth(), nairobiDate.getDate())

    const diffDays = Math.round((todayMidnight - msgMidnight) / (1000 * 60 * 60 * 24))

    let dateLabel
    if (diffDays === 0) dateLabel = 'Today'
    else if (diffDays === 1) dateLabel = 'Yesterday'
    else if (diffDays <= 7) dateLabel = nairobiDate.toLocaleDateString('en-KE', { weekday: 'long' })
    else dateLabel = nairobiDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

    if (dateLabel !== lastLabel) {
      groups.push({ type: 'date', label: dateLabel })
      lastLabel = dateLabel
    }
    groups.push({ type: 'message', ...msg })
  }
  return groups
})
</script>

<template>
  <!-- INLINE MODE -->
  <div v-if="inline" class="flex flex-col flex-1 overflow-hidden">

    <div ref="messagesEl" class="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
      <div v-if="messages.length === 0" class="text-center text-gray-400 text-sm py-16">
        <div class="text-4xl mb-2">👋</div>
        No messages yet. Say hello!
      </div>

      <template v-for="item in groupedMessages" :key="item.type === 'date' ? item.label : item.id">
        <div v-if="item.type === 'date'" class="flex items-center justify-center py-2">
          <span class="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{{ item.label }}</span>
        </div>

        <div v-else class="flex" :class="item.sender_id === user.id ? 'justify-end' : 'justify-start'">
          <div class="max-w-xs px-4 py-2 rounded-2xl text-sm shadow-sm"
            :class="item.sender_id === user.id
              ? 'bg-green-500 text-white rounded-br-sm'
              : 'bg-white text-gray-800 rounded-bl-sm'">
            <p>{{ item.body }}</p>
            <div class="flex items-center justify-end gap-1 mt-1">
              <span class="text-xs opacity-60">{{ timeStr(item.created_at) }}</span>
              <span v-if="item.sender_id === user.id">
                <svg v-if="!item.read" class="w-4 h-3.5 opacity-70" viewBox="0 0 16 11" fill="none">
                  <path d="M1 5.5L5.5 10L15 1" stroke="white" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg v-else class="w-5 h-3.5" viewBox="0 0 20 11" fill="none">
                  <path d="M1 5.5L5.5 10L15 1" stroke="#90CAF9" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M6 5.5L10.5 10L20 1" stroke="#90CAF9" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- System message: contact viewed — outside loop, shows even with no messages -->
      <div v-if="contactViewedAt" class="flex justify-center py-2">
        <div class="bg-blue-50 border border-blue-100 text-blue-600 text-xs px-4 py-2 rounded-full flex items-center gap-2">
          📞 You viewed {{ contactName }}'s phone number at {{ contactViewedAt }}
        </div>
      </div>
    </div>

    <!-- Quick replies — hidden for spam -->
    <div v-if="!isSpam" class="px-4 pt-2 pb-1 bg-white border-t flex gap-2 overflow-x-auto">
      <button v-for="chip in quickReplies" :key="chip" @click="useQuickReply(chip)"
        class="shrink-0 px-3 py-1.5 border border-green-500 text-green-600 rounded-full text-xs font-medium hover:bg-green-50 transition whitespace-nowrap">
        {{ chip }}
      </button>
    </div>

    <!-- Input — disabled for spam -->
    <div v-if="!isSpam" class="px-4 py-3 border-t bg-white flex gap-2">
      <textarea v-model="newMessage" @keydown="handleKeydown" rows="1"
        placeholder="Type a message..."
        class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
      <button @click="sendMessage" :disabled="!newMessage.trim() || sending"
        class="w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0"
        :class="newMessage.trim() ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-100 text-gray-300'">
        ➤
      </button>
    </div>
    <div v-else class="px-4 py-3 border-t bg-gray-50 text-center text-sm text-gray-400">
      🚫 You cannot reply to spam conversations
    </div>
  </div>

  <!-- DRAWER MODE -->
  <Teleport to="body" v-else>
    <Transition name="drawer">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black bg-opacity-40" @click="close" />
        <div class="relative w-full max-w-sm bg-white flex flex-col shadow-2xl h-full">

          <div class="flex items-center gap-3 px-4 py-3 border-b bg-white shadow-sm">
            <button @click="close"
              class="text-gray-400 hover:text-gray-600 transition text-xl mr-1 shrink-0">✕</button>
            <div class="w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
              <img v-if="listing?.listing_images?.length"
  :src="[...listing.listing_images].sort((a,b) => a.position - b.position)[0]?.url"
  class="w-full h-full object-cover" />
<div v-else class="w-full h-full flex items-center justify-center">
  <Icon icon="mdi:sprout" class="w-6 h-6 text-gray-400" />
</div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-800 text-sm truncate">{{ listing?.title }}</p>
              <p class="text-green-600 font-bold text-sm">
                KSh {{ Number(listing?.price).toLocaleString('en-KE') }}
              </p>
            </div>
          </div>

          <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            <div v-if="messages.length === 0"
              class="text-center text-gray-400 text-sm py-16">
              <div class="text-4xl mb-2">👋</div>
              No messages yet. Say hello!
            </div>

            <template v-for="item in groupedMessages"
              :key="item.type === 'date' ? item.label : item.id">
              <div v-if="item.type === 'date'"
                class="flex items-center justify-center py-2">
                <span class="text-xs text-gray-400 bg-gray-200 px-3 py-1 rounded-full">
                  {{ item.label }}
                </span>
              </div>

              <div v-else class="flex"
                :class="item.sender_id === user.id ? 'justify-end' : 'justify-start'">
                <div class="max-w-xs px-4 py-2 rounded-2xl text-sm shadow-sm"
                  :class="item.sender_id === user.id
                    ? 'bg-green-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm'">
                  <p>{{ item.body }}</p>
                  <div class="flex items-center justify-end gap-1 mt-1">
                    <span class="text-xs opacity-60">{{ timeStr(item.created_at) }}</span>
                    <span v-if="item.sender_id === user.id">
                      <svg v-if="!item.read" class="w-4 h-3.5 opacity-70"
                        viewBox="0 0 16 11" fill="none">
                        <path d="M1 5.5L5.5 10L15 1" stroke="white" stroke-width="1.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <svg v-else class="w-5 h-3.5" viewBox="0 0 20 11" fill="none">
                        <path d="M1 5.5L5.5 10L15 1" stroke="#90CAF9" stroke-width="1.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M6 5.5L10.5 10L20 1" stroke="#90CAF9" stroke-width="1.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <!-- System message: contact viewed — outside loop -->
            <div v-if="contactViewedAt" class="flex justify-center py-2">
              <div class="bg-blue-50 border border-blue-100 text-blue-600 text-xs px-4 py-2 rounded-full flex items-center gap-2">
                📞 You viewed {{ contactName }}'s phone number at {{ contactViewedAt }}
              </div>
            </div>
          </div>

          <!-- Quick replies — hidden for spam -->
          <div v-if="!isSpam"
            class="px-4 pt-2 pb-1 bg-white border-t flex gap-2 overflow-x-auto">
            <button v-for="chip in quickReplies" :key="chip" @click="useQuickReply(chip)"
              class="shrink-0 px-3 py-1.5 border border-green-500 text-green-600 rounded-full text-xs font-medium hover:bg-green-50 transition whitespace-nowrap">
              {{ chip }}
            </button>
          </div>

          <!-- Input — disabled for spam -->
          <div v-if="!isSpam" class="px-4 py-3 bg-white flex gap-2">
            <textarea v-model="newMessage" @keydown="handleKeydown" rows="1"
              placeholder="Type a message..."
              class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button @click="sendMessage" :disabled="!newMessage.trim() || sending"
              class="w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0"
              :class="newMessage.trim()
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-100 text-gray-300'">
              ➤
            </button>
          </div>
          <div v-else class="px-4 py-3 border-t bg-gray-50 text-center text-sm text-gray-400">
            🚫 You cannot reply to spam conversations
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