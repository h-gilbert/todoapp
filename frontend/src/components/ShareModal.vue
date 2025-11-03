<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <h2>Share Project</h2>
        <button @click="close" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <p class="project-name">{{ project?.name }}</p>

        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="success" class="success-message">{{ success }}</div>

        <!-- Share with new user -->
        <div class="share-section">
          <h3>Share with user</h3>
          <div class="share-input-group">
            <input
              v-model="usernameToShare"
              type="text"
              placeholder="Enter username"
              class="share-input"
              @keyup.enter="handleShare"
            />
            <button @click="handleShare" class="share-button" :disabled="loading || !usernameToShare.trim()">
              Share
            </button>
          </div>
        </div>

        <!-- List of shared users -->
        <div v-if="shares.length > 0" class="shares-section">
          <h3>Shared with</h3>
          <div v-for="share in shares" :key="share.id" class="share-item">
            <div class="share-user">
              <span class="username">{{ share.username }}</span>
            </div>
            <button @click="handleRemoveShare(share.id)" class="remove-button" title="Remove access">
              Remove
            </button>
          </div>
        </div>
        <div v-else class="no-shares">
          <p>Not shared with anyone yet</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAppStore } from '../stores/app'

const props = defineProps({
  show: Boolean,
  project: Object
})

const emit = defineEmits(['close'])

const store = useAppStore()
const usernameToShare = ref('')
const shares = ref([])
const error = ref('')
const success = ref('')
const loading = ref(false)

// Load shares when modal opens
watch(() => props.show, async (isShown) => {
  if (isShown && props.project) {
    await loadShares()
  }
})

async function loadShares() {
  if (!props.project) return
  try {
    shares.value = await store.getProjectShares(props.project.id)
  } catch (err) {
    console.error('Failed to load shares:', err)
  }
}

async function handleShare() {
  if (!usernameToShare.value.trim()) return

  error.value = ''
  success.value = ''
  loading.value = true

  try {
    await store.shareProject(props.project.id, usernameToShare.value.trim())
    success.value = `Project shared with ${usernameToShare.value}`
    usernameToShare.value = ''
    await loadShares()

    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleRemoveShare(shareUserId) {
  error.value = ''
  success.value = ''

  try {
    await store.removeProjectShare(props.project.id, shareUserId)
    success.value = 'Access removed'
    await loadShares()

    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err) {
    error.value = err.message
  }
}

function close() {
  error.value = ''
  success.value = ''
  usernameToShare.value = ''
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #2d3436;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  color: #636e72;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-button:hover {
  background: #f0f0f0;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.project-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: #2d3436;
  margin-bottom: 1.5rem;
}

.error-message {
  background: #ff7675;
  color: white;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.success-message {
  background: #55efc4;
  color: #2d3436;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.share-section {
  margin-bottom: 2rem;
}

.share-section h3 {
  font-size: 1rem;
  color: #2d3436;
  margin-bottom: 0.75rem;
}

.share-input-group {
  display: flex;
  gap: 0.5rem;
}

.share-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #dfe6e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.share-input:focus {
  outline: none;
  border-color: #a29bfe;
}

.share-button {
  padding: 0.75rem 1.5rem;
  background: #a29bfe;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.share-button:hover:not(:disabled) {
  background: #6c5ce7;
}

.share-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shares-section h3 {
  font-size: 1rem;
  color: #2d3436;
  margin-bottom: 0.75rem;
}

.share-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.share-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.username {
  font-weight: 500;
  color: #2d3436;
  font-size: 0.95rem;
}

.remove-button {
  padding: 0.5rem 1rem;
  background: #ff7675;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.remove-button:hover {
  background: #d63031;
}

.no-shares {
  text-align: center;
  padding: 2rem;
  color: #636e72;
}

.no-shares p {
  margin: 0;
}
</style>
