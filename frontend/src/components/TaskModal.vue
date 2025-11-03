<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h2>{{ isEdit ? 'Edit Task' : 'New Task' }}</h2>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const props = defineProps({
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save', 'delete', 'uncross', 'complete'])

const isEdit = computed(() => !!props.task)

const title = ref(props.task?.title || '')
const description = ref(props.task?.description || '')
const photos = ref([])
const titleInputRef = ref(null)
const fileInput = ref(null)
const lightboxPhoto = ref(null)

onMounted(async () => {
  await nextTick()
  titleInputRef.value?.focus()

  // Load existing photos if editing
  if (isEdit.value) {
    photos.value = await store.getTaskPhotos(props.task.id)
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
      description: description.value.trim()
    })
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
</style>
