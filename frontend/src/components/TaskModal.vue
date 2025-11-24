<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h2>{{ isEdit ? 'Edit Task' : 'New Task' }}</h2>
      <div v-if="isSubtask && (projectName || sectionName || parentTask)" class="breadcrumb">
        <span v-if="projectName">{{ projectName }}</span>
        <span v-if="projectName && sectionName" class="separator">›</span>
        <span v-if="sectionName">{{ sectionName }}</span>
        <span v-if="(projectName || sectionName) && parentTask" class="separator">›</span>
        <span v-if="parentTask" class="parent-task">{{ parentTask.title }}</span>
        <span v-if="parentTask && isEdit" class="separator">›</span>
        <span v-if="isEdit" class="current-task">{{ task.title }}</span>
      </div>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>Title</label>
          <input
            ref="titleInputRef"
            v-model="title"
            type="text"
            placeholder="Task title"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea
            v-model="description"
            placeholder="Task description (optional)"
            class="form-textarea"
            rows="4"
          ></textarea>
        </div>
        <div class="form-group" v-if="store.labels.length > 0">
          <label>Labels</label>
          <div class="labels-select">
            <button
              v-for="label in store.labels"
              :key="label.id"
              type="button"
              @click="toggleLabel(label.id)"
              class="label-chip"
              :class="{ selected: selectedLabels.includes(label.id) }"
              :style="selectedLabels.includes(label.id) ? { backgroundColor: label.color, color: 'white' } : { borderColor: label.color, color: label.color }"
            >
              {{ label.name }}
            </button>
          </div>
        </div>
        <div class="form-group" v-if="isEdit && subtasksList.length > 0">
          <label>Subtasks ({{ completedSubtasksCount }}/{{ subtasksList.length }})</label>
          <div class="subtasks-list">
            <div v-for="subtask in subtasksList" :key="subtask.id" class="subtask-item">
              <input
                type="checkbox"
                :checked="subtask.completed"
                @change="handleToggleSubtask(subtask.id, $event.target.checked)"
                @click.stop
                class="subtask-checkbox"
              />
              <span
                :class="{ 'subtask-completed': subtask.completed, 'subtask-clickable': true }"
                @click="openSubtaskModal(subtask)"
              >
                {{ subtask.title }}
              </span>
              <span v-if="subtask.completed_at" class="subtask-timestamp" :title="new Date(subtask.completed_at).toLocaleString()">
                {{ formatTimestamp(subtask.completed_at) }}
              </span>
            </div>
          </div>
          <button type="button" @click="openAddSubtaskModal" class="btn-add-subtask">
            + Add Subtask
          </button>
        </div>
        <div class="form-group" v-if="isEdit && subtasksList.length === 0">
          <button type="button" @click="openAddSubtaskModal" class="btn-add-subtask">
            + Add Subtask
          </button>
        </div>
        <div class="form-group">
          <label>Photos</label>
          <div class="photos-section">
            <div v-if="photos.length > 0" class="photos-grid">
              <div v-for="photo in photos" :key="photo.id" class="photo-item">
                <img :src="`/uploads/${photo.filename}`" :alt="photo.original_name" @click="openLightbox(photo)" />
                <button type="button" @click="handleDeletePhoto(photo.id)" class="delete-photo-btn">×</button>
              </div>
            </div>
            <div class="upload-zone">
              <input
                ref="fileInput"
                type="file"
                @change="handleFileSelect"
                accept="image/*"
                multiple
                style="display: none"
              />
              <button type="button" @click="triggerFileInput" class="btn-upload">
                Add Photos
              </button>
              <span class="upload-hint">Up to 5 images (10MB each)</span>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <div class="left-actions">
            <button
              v-if="isEdit && task.completed && task.programmatic_completion"
              type="button"
              @click="handleUncross"
              class="btn-uncross"
            >
              Uncross
            </button>
            <button
              v-if="isEdit && !task.completed"
              type="button"
              @click="handleComplete"
              class="btn-complete"
            >
              Complete
            </button>
            <button
              v-if="isEdit"
              type="button"
              @click="handleDelete"
              class="btn-delete"
            >
              Delete
            </button>
          </div>
          <div class="right-actions">
            <button type="button" @click="$emit('close')" class="btn-cancel">
              Cancel
            </button>
            <button type="submit" class="btn-save" :disabled="!title.trim()">
              {{ isEdit ? 'Save' : 'Create' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Lightbox -->
    <div v-if="lightboxPhoto" class="lightbox" @click="closeLightbox">
      <button class="lightbox-close" @click="closeLightbox">×</button>
      <img :src="`/uploads/${lightboxPhoto.filename}`" :alt="lightboxPhoto.original_name" @click.stop />
    </div>

    <!-- Nested Subtask Modal -->
    <Teleport to="body">
      <TaskModal
        v-if="editingSubtask"
        :task="editingSubtask"
        :projectName="projectName"
        :sectionName="sectionName"
        :parentTask="task"
        @close="closeSubtaskModal"
        @save="handleSubtaskSave"
        @delete="handleSubtaskDelete"
      />
      <TaskModal
        v-if="showAddSubtaskModal"
        :projectName="projectName"
        :sectionName="sectionName"
        :parentTask="task"
        @close="closeAddSubtaskModal"
        @save="handleAddSubtask"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()

// Format timestamp as relative time (e.g., "2 hours ago") or date
function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const props = defineProps({
  task: {
    type: Object,
    default: null
  },
  projectName: {
    type: String,
    default: ''
  },
  sectionName: {
    type: String,
    default: ''
  },
  parentTask: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save', 'delete', 'uncross', 'complete'])

const isEdit = computed(() => !!props.task)
const isSubtask = computed(() => !!props.parentTask || !!props.task?.parent_task_id)

const title = ref(props.task?.title || '')
const description = ref(props.task?.description || '')
const selectedLabels = ref([])
const subtasksList = ref([])
const showAddSubtask = ref(false)
const newSubtaskTitle = ref('')
const photos = ref([])
const titleInputRef = ref(null)
const fileInput = ref(null)
const lightboxPhoto = ref(null)
const editingSubtask = ref(null)
const showAddSubtaskModal = ref(false)

const completedSubtasksCount = computed(() => {
  return subtasksList.value.filter(s => s.completed).length
})

onMounted(async () => {
  await nextTick()
  titleInputRef.value?.focus()

  // Load existing data if editing
  if (isEdit.value) {
    photos.value = await store.getTaskPhotos(props.task.id)

    // Load task labels
    const labels = await store.getTaskLabels(props.task.id)
    selectedLabels.value = labels.map(l => l.id)

    // Load subtasks
    subtasksList.value = await store.loadSubtasks(props.task.id)
  }

  // Add keyboard shortcut listener
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // Clean up keyboard shortcut listener
  window.removeEventListener('keydown', handleKeyDown)
})

function handleKeyDown(event) {
  // Close lightbox on Escape
  if (event.key === 'Escape' && lightboxPhoto.value) {
    closeLightbox()
    return
  }

  // Check for CMD+Enter (Mac) or Ctrl+Enter (Windows/Linux)
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  }
}

function handleSubmit() {
  if (title.value.trim()) {
    emit('save', {
      title: title.value.trim(),
      description: description.value.trim(),
      selectedLabels: selectedLabels.value
    })
  }
}

function toggleLabel(labelId) {
  const index = selectedLabels.value.indexOf(labelId)
  if (index > -1) {
    selectedLabels.value.splice(index, 1)
  } else {
    selectedLabels.value.push(labelId)
  }
}

// Refresh parent task to update subtask counts in real-time
async function refreshParentTask() {
  if (!props.task || !props.task.id || !props.task.section_id) return

  try {
    // Fetch the updated task from backend
    const response = await fetch(`/api/tasks/${props.task.id}`)
    if (!response.ok) return

    const updatedTask = await response.json()

    // Update the task in the store's tasks array for this section
    const sectionTasks = store.tasks[props.task.section_id]
    if (sectionTasks) {
      const taskIndex = sectionTasks.findIndex(t => t.id === props.task.id)
      if (taskIndex !== -1) {
        // Update the task while preserving reactivity
        Object.assign(sectionTasks[taskIndex], updatedTask)
      }
    }
  } catch (error) {
    console.error('Error refreshing parent task:', error)
  }
}

// Handle adding subtask from modal
async function handleAddSubtask({ title, description, selectedLabels }) {
  try {
    const subtask = await store.createTask(props.task.section_id, title, description, props.task.id)

    // Add labels if any
    if (selectedLabels && selectedLabels.length > 0) {
      for (const labelId of selectedLabels) {
        await store.addLabelToTask(subtask.id, labelId)
      }
    }

    // Reload subtasks
    await store.loadSubtasks(props.task.id, true)
    subtasksList.value = await store.loadSubtasks(props.task.id)

    // Reload parent task to get updated subtask counts
    await refreshParentTask()

    showAddSubtaskModal.value = false
  } catch (error) {
    console.error('Error adding subtask:', error)
    alert('Failed to add subtask')
  }
}

async function handleToggleSubtask(subtaskId, completed) {
  try {
    await store.updateTask(subtaskId, { completed })

    // Reload subtasks to get updated completed_at timestamp
    subtasksList.value = await store.loadSubtasks(props.task.id, true)

    // Reload parent task to get updated completed_subtask_count
    await refreshParentTask()
  } catch (error) {
    console.error('Error toggling subtask:', error)
    alert('Failed to update subtask')
  }
}

// Subtask modal handlers
function openSubtaskModal(subtask) {
  editingSubtask.value = subtask
}

function closeSubtaskModal() {
  editingSubtask.value = null
}

function openAddSubtaskModal() {
  showAddSubtaskModal.value = true
}

function closeAddSubtaskModal() {
  showAddSubtaskModal.value = false
}

async function handleSubtaskSave({ title, description, selectedLabels }) {
  try {
    await store.updateTask(editingSubtask.value.id, { title, description })

    // Update labels
    const currentLabels = await store.getTaskLabels(editingSubtask.value.id, true)
    const currentLabelIds = currentLabels.map(l => l.id)

    // Add new labels
    for (const labelId of selectedLabels) {
      if (!currentLabelIds.includes(labelId)) {
        await store.addLabelToTask(editingSubtask.value.id, labelId)
      }
    }

    // Remove deselected labels
    for (const labelId of currentLabelIds) {
      if (!selectedLabels.includes(labelId)) {
        await store.removeLabelFromTask(editingSubtask.value.id, labelId)
      }
    }

    // Reload subtasks
    subtasksList.value = await store.loadSubtasks(props.task.id, true)

    closeSubtaskModal()
  } catch (error) {
    console.error('Error updating subtask:', error)
    alert('Failed to update subtask')
  }
}

async function handleSubtaskDelete() {
  if (confirm('Are you sure you want to delete this subtask?')) {
    try {
      await store.deleteTask(editingSubtask.value.id)
      subtasksList.value = await store.loadSubtasks(props.task.id, true)

      // Reload parent task to get updated subtask_count
      await refreshParentTask()

      closeSubtaskModal()
    } catch (error) {
      console.error('Error deleting subtask:', error)
      alert('Failed to delete subtask')
    }
  }
}

function handleDelete() {
  if (confirm('Are you sure you want to delete this task?')) {
    emit('delete')
  }
}

function handleUncross() {
  emit('uncross')
}

function handleComplete() {
  emit('complete')
}

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event) {
  const files = Array.from(event.target.files)

  if (!isEdit.value) {
    // Can't upload photos to unsaved task
    alert('Please save the task first before adding photos')
    return
  }

  if (files.length + photos.value.length > 5) {
    alert('Maximum 5 photos allowed per task')
    return
  }

  try {
    const newPhotos = await store.uploadTaskPhotos(props.task.id, files)
    photos.value = [...photos.value, ...newPhotos]

    // Update cache with new photos
    store.photoCache[props.task.id] = photos.value

    // Clear file input
    event.target.value = ''
  } catch (error) {
    console.error('Error uploading photos:', error)
    alert('Failed to upload photos')
  }
}

async function handleDeletePhoto(photoId) {
  if (confirm('Delete this photo?')) {
    try {
      await store.deletePhoto(photoId, props.task.id)
      photos.value = photos.value.filter(p => p.id !== photoId)

      // Update cache with remaining photos
      store.photoCache[props.task.id] = photos.value
    } catch (error) {
      console.error('Error deleting photo:', error)
      alert('Failed to delete photo')
    }
  }
}

function openLightbox(photo) {
  lightboxPhoto.value = photo
}

function closeLightbox() {
  lightboxPhoto.value = null
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
  min-width: 500px;
  max-width: 600px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

h2 {
  margin-bottom: 1.5rem;
  color: #2d3436;
  font-size: 1.5rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #636e72;
}

.breadcrumb .separator {
  color: #b2bec3;
  font-weight: 300;
}

.breadcrumb .parent-task {
  color: #74b9ff;
  font-weight: 500;
}

.breadcrumb .current-task {
  color: #a29bfe;
  font-weight: 600;
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

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #dfe6e9;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #a29bfe;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-actions,
.right-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-cancel,
.btn-save,
.btn-delete,
.btn-uncross,
.btn-complete {
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

.btn-delete {
  background: #ff7675;
  color: white;
}

.btn-delete:hover {
  background: #d63031;
}

.btn-uncross {
  background: #74b9ff;
  color: white;
}

.btn-uncross:hover {
  background: #0984e3;
}

.btn-complete {
  background: #55efc4;
  color: #2d3436;
}

.btn-complete:hover {
  background: #00b894;
  color: white;
}

.photos-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.75rem;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s;
}

.photo-item img:hover {
  transform: scale(1.05);
}

.delete-photo-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 118, 117, 0.9);
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition: background 0.2s;
}

.delete-photo-btn:hover {
  background: #d63031;
}

.upload-zone {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-upload {
  padding: 0.625rem 1.25rem;
  border: 2px dashed #a29bfe;
  background: transparent;
  color: #a29bfe;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-upload:hover {
  background: #f8f7ff;
  border-color: #6c5ce7;
  color: #6c5ce7;
}

.upload-hint {
  font-size: 0.8rem;
  color: #636e72;
}

.lightbox {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  cursor: pointer;
}

.lightbox img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  cursor: default;
}

.lightbox-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: #2d3436;
  font-size: 30px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition: background 0.2s;
}

.lightbox-close:hover {
  background: white;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
}

.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #dfe6e9;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.form-select:focus {
  outline: none;
  border-color: #a29bfe;
}

.labels-select {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.label-chip {
  padding: 0.4rem 0.8rem;
  border: 2px solid;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
}

.label-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.label-chip.selected {
  border-color: transparent !important;
}

.subtasks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.subtask-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.subtask-completed {
  text-decoration: line-through;
  color: #636e72;
}

.subtask-clickable {
  cursor: pointer;
  flex: 1;
}

.subtask-clickable:hover {
  color: #a29bfe;
  text-decoration: underline;
}

.subtask-timestamp {
  font-size: 0.7rem;
  color: #00b894;
  background: #d4f5ec;
  padding: 0.15rem 0.4rem;
  border-radius: 8px;
  white-space: nowrap;
}

.btn-add-subtask {
  padding: 0.5rem 1rem;
  border: 2px dashed #b2bec3;
  background: transparent;
  color: #636e72;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-subtask:hover {
  border-color: #a29bfe;
  color: #a29bfe;
  background: #f8f7ff;
}

.add-subtask-form {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.add-subtask-form .form-input {
  flex: 1;
  margin: 0;
}

.btn-save-subtask {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 8px;
  background: #a29bfe;
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save-subtask:hover {
  background: #6c5ce7;
}
</style>
