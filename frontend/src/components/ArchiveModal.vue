<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content archive-modal" @click.stop>
      <button @click="$emit('close')" class="close-button">&times;</button>
      <h2>Archive</h2>

      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'tasks' }]"
          @click="activeTab = 'tasks'"
        >
          Tasks ({{ archivedTasks.length }})
        </button>
        <button
          :class="['tab', { active: activeTab === 'sections' }]"
          @click="activeTab = 'sections'"
        >
          Sections ({{ archivedSections.length }})
        </button>
      </div>

      <div v-if="loading" class="loading">Loading...</div>

      <!-- Tasks Tab -->
      <div v-else-if="activeTab === 'tasks'" class="tab-content">
        <div v-if="archivedTasks.length === 0" class="empty-state">
          <p>No archived tasks</p>
        </div>

        <div v-else class="archived-list">
          <div
            v-for="task in archivedTasks"
            :key="task.id"
            class="archived-item"
          >
            <div class="item-info">
              <div class="item-header">
                <span class="item-title">{{ task.title }}</span>
                <span class="section-badge">{{ task.section_name }}</span>
              </div>
              <p v-if="task.description" class="item-description">{{ task.description }}</p>
            </div>
            <button @click="handleUnarchiveTask(task.id)" class="restore-button">
              Restore
            </button>
          </div>
        </div>
      </div>

      <!-- Sections Tab -->
      <div v-else-if="activeTab === 'sections'" class="tab-content">
        <div v-if="archivedSections.length === 0" class="empty-state">
          <p>No archived sections</p>
        </div>

        <div v-else class="archived-list">
          <div
            v-for="section in archivedSections"
            :key="section.id"
            class="archived-item"
          >
            <div class="item-info">
              <div class="item-header">
                <span class="item-title">{{ section.name }}</span>
              </div>
            </div>
            <button @click="handleUnarchiveSection(section.id)" class="restore-button">
              Restore
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAppStore } from '../stores/app'

const emit = defineEmits(['close'])
const store = useAppStore()

const activeTab = ref('tasks')
const archivedTasks = ref([])
const archivedSections = ref([])
const loading = ref(true)

onMounted(async () => {
  await Promise.all([
    loadArchivedTasks(),
    loadArchivedSections()
  ])
  loading.value = false
})

async function loadArchivedTasks() {
  archivedTasks.value = await store.getArchivedTasks()
}

async function loadArchivedSections() {
  archivedSections.value = await store.getArchivedSections()
}

async function handleUnarchiveTask(taskId) {
  await store.unarchiveTask(taskId)
  // Remove from the list
  archivedTasks.value = archivedTasks.value.filter(t => t.id !== taskId)
}

async function handleUnarchiveSection(sectionId) {
  await store.unarchiveSection(sectionId)
  // Remove from the list
  archivedSections.value = archivedSections.value.filter(s => s.id !== sectionId)
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
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
}

.archive-modal {
  min-width: 600px;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 2rem;
  color: #636e72;
  cursor: pointer;
  line-height: 1;
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
  background: #f1f3f5;
}

h2 {
  margin-bottom: 1rem;
  color: #2d3436;
  font-size: 1.5rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e1e4e8;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: #636e72;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -2px;
}

.tab:hover {
  color: #2d3436;
  background: #f8f9fa;
}

.tab.active {
  color: #a29bfe;
  border-bottom-color: #a29bfe;
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #636e72;
}

.archived-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.archived-item {
  display: flex;
  align-items: start;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: background 0.2s;
}

.archived-item:hover {
  background: #e9ecef;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.item-title {
  font-weight: 500;
  color: #2d3436;
  font-size: 0.95rem;
}

.section-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: #dfe6e9;
  color: #636e72;
  border-radius: 4px;
  font-weight: 600;
}

.item-description {
  color: #636e72;
  font-size: 0.85rem;
  line-height: 1.4;
  margin-top: 0.25rem;
}

.restore-button {
  padding: 0.5rem 1rem;
  background: #a29bfe;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.restore-button:hover {
  background: #6c5ce7;
}
</style>
