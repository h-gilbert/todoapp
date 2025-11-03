<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <h2>Change Password</h2>
        <button @click="close" class="close-button">&times;</button>
      </div>

      <div class="modal-body">
        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="success" class="success-message">{{ success }}</div>

        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              v-model="currentPassword"
              type="password"
              class="form-input"
              required
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="newPassword">New Password</label>
            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              class="form-input"
              placeholder="Minimum 6 characters"
              required
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              class="form-input"
              required
              :disabled="loading"
            />
          </div>

          <div class="modal-actions">
            <button type="button" @click="close" class="btn-cancel" :disabled="loading">
              Cancel
            </button>
            <button type="submit" class="btn-submit" :disabled="loading">
              {{ loading ? 'Changing...' : 'Change Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAppStore } from '../stores/app'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close'])

const store = useAppStore()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

watch(() => props.show, (isShown) => {
  if (isShown) {
    // Reset form when modal opens
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    error.value = ''
    success.value = ''
  }
})

async function handleSubmit() {
  error.value = ''
  success.value = ''

  // Validation
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    error.value = 'All fields are required'
    return
  }

  if (newPassword.value.length < 6) {
    error.value = 'New password must be at least 6 characters'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    error.value = 'New passwords do not match'
    return
  }

  if (currentPassword.value === newPassword.value) {
    error.value = 'New password must be different from current password'
    return
  }

  loading.value = true

  try {
    await store.changePassword(currentPassword.value, newPassword.value)
    success.value = 'Password changed successfully'

    // Close modal after a short delay
    setTimeout(() => {
      close()
    }, 1500)
  } catch (err) {
    error.value = err.message || 'Failed to change password'
  } finally {
    loading.value = false
  }
}

function close() {
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
  max-width: 450px;
  overflow: hidden;
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
  font-weight: 500;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2d3436;
  font-size: 0.9rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #dfe6e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #a29bfe;
}

.form-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-cancel,
.btn-submit {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f8f9fa;
  color: #636e72;
}

.btn-cancel:hover:not(:disabled) {
  background: #e9ecef;
}

.btn-submit {
  background: #a29bfe;
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: #6c5ce7;
}

.btn-cancel:disabled,
.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
