<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h2>{{ project ? 'Edit Project' : 'New Project' }}</h2>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>Project Name</label>
          <input
            ref="inputRef"
            v-model="name"
            type="text"
            placeholder="Enter project name"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <textarea
            v-model="description"
            placeholder="What is this project about? What are you trying to achieve?"
            class="form-input"
            rows="3"
          />
        </div>
        <div class="modal-actions">
          <button type="button" @click="$emit('close')" class="btn-cancel">
            Cancel
          </button>
          <button type="submit" class="btn-save" :disabled="!name.trim()">
            {{ project ? 'Save' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save'])

const name = ref(props.project?.name || '')
const description = ref(props.project?.description || '')
const inputRef = ref(null)

onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()

  // Add keyboard shortcut listener
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // Clean up keyboard shortcut listener
  window.removeEventListener('keydown', handleKeyDown)
})

function handleKeyDown(event) {
  // Check for CMD+Enter (Mac) or Ctrl+Enter (Windows/Linux)
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  }
}

function handleSubmit() {
  if (name.value.trim()) {
    emit('save', { name: name.value.trim(), description: description.value.trim() })
  }
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
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  min-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

h2 {
  margin-bottom: 1.5rem;
  color: #2d3436;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #2d3436;
  font-weight: 500;
  font-size: 0.9rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #dfe6e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
  font-family: inherit;
  resize: vertical;
}

.form-input:focus {
  outline: none;
  border-color: #a29bfe;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel,
.btn-save {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #dfe6e9;
  color: #636e72;
}

.btn-cancel:hover {
  background: #b2bec3;
}

.btn-save {
  background: #a29bfe;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #6c5ce7;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
