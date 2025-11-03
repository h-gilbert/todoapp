<template>
  <div class="task-item" :class="{
    completed: task.completed,
    'programmatic-completion': task.programmatic_completion
  }" :data-task-id="task.id">
    <input
      type="checkbox"
      :checked="task.completed && !task.programmatic_completion"
      @change="handleToggle"
      class="task-checkbox"
    />
    <div class="task-content" @click="showEditModal = true">
      <div class="task-title">{{ task.title }}</div>
      <div v-if="task.description" class="task-description">{{ task.description }}</div>
      <div v-if="photos.length > 0" class="task-photos">
        <div v-for="photo in photos.slice(0, 3)" :key="photo.id" class="photo-thumbnail">
          <img :src="`/uploads/${photo.filename}`" :alt="photo.original_name" />
        </div>
        <div v-if="photos.length > 3" class="photo-count">+{{ photos.length - 3 }}</div>
      </div>
    </div>

    <Teleport to="body">
      <TaskModal
        v-if="showEditModal"
        :task="task"
        @close="handleModalClose"
        @save="handleUpdate"
        @delete="handleDelete"
        @uncross="handleUncross"
        @complete="handleComplete"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '../stores/app'
import TaskModal from './TaskModal.vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const store = useAppStore()
const showEditModal = ref(false)

// Use computed to get cached photos
const photos = computed(() => store.photoCache[props.task.id] || [])

onMounted(async () => {
  // Load photos for this task (will use cache if available)
  await store.getTaskPhotos(props.task.id)
})

async function handleToggle(event) {
  const isChecked = event.target.checked

  if (isChecked) {
    // When checking the checkbox, always archive (whether it was already completed or not)
    // Also clear programmatic_completion flag
    await store.toggleTaskComplete(props.task.id, true, true, false)
  } else {
    // When unchecking, just mark as incomplete (no auto-archive)
    // Also clear programmatic_completion flag
    await store.toggleTaskComplete(props.task.id, false, false, false)
  }
}

async function handleUpdate({ title, description }) {
  await store.updateTask(props.task.id, { title, description })
  showEditModal.value = false
}

async function handleDelete() {
  await store.deleteTask(props.task.id)
  showEditModal.value = false
}

async function handleUncross() {
  await store.updateTask(props.task.id, { completed: 0, programmatic_completion: 0 })
  showEditModal.value = false
}

async function handleComplete() {
  // Mark task as complete and archive it
  await store.toggleTaskComplete(props.task.id, true, true, false)
  showEditModal.value = false
}

function handleModalClose() {
  showEditModal.value = false
  // Photos are cached in the store, no need to reload
}
</script>

<style scoped>
.task-item {
  background: white;
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  gap: 0.75rem;
  align-items: start;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.task-item.highlighted {
  background: #fff3cd;
  border-color: #ffc107;
  box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.3);
}

.task-item:hover {
  border-color: #a29bfe;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(162, 155, 254, 0.15);
}

.task-item.completed {
  opacity: 0.6;
}

.task-item.programmatic-completion {
  opacity: 0.8;
}

.task-item.programmatic-completion .task-checkbox {
  /* Show checkbox as unchecked, but task appears crossed out */
  opacity: 0.7;
}

.task-checkbox {
  margin-top: 0.15rem;
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: #a29bfe;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 0.9rem;
  color: #2d3436;
  font-weight: 500;
  margin-bottom: 0.25rem;
  word-wrap: break-word;
}

.task-item.completed .task-title,
.task-item.programmatic-completion .task-title {
  text-decoration: line-through;
}

.task-description {
  font-size: 0.85rem;
  color: #636e72;
  line-height: 1.4;
  word-wrap: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-item.completed .task-description,
.task-item.programmatic-completion .task-description {
  text-decoration: line-through;
}

.task-photos {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  align-items: center;
}

.photo-thumbnail {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: #f8f9fa;
  flex-shrink: 0;
}

.photo-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-count {
  font-size: 0.75rem;
  color: #636e72;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  background: #dfe6e9;
  border-radius: 12px;
}
</style>
