<template>
  <div class="section" :data-section-id="section.id">
    <div class="section-header">
      <h3>{{ section.name }}</h3>
      <div class="section-actions">
        <button @click.stop="handleContextMenu" class="menu-btn" title="Section menu">⋮</button>
        <button @click="showNewTaskModal = true" class="add-task-btn" title="Add task">+</button>
      </div>
    </div>

    <draggable
      :model-value="sectionTasks"
      @update:model-value="updateTasks"
      @end="handleTaskDragEnd"
      item-key="id"
      group="tasks"
      class="tasks-list"
    >
      <template #item="{ element }">
        <TaskItem :task="element" />
      </template>
    </draggable>

    <button @click="showNewTaskModal = true" class="add-task-link">
      + Add task
    </button>

    <Teleport to="body">
      <TaskModal
        v-if="showNewTaskModal"
        @close="showNewTaskModal = false"
        @save="handleCreateTask"
      />
      <SectionModal
        v-if="editingSection"
        :section="editingSection"
        @close="editingSection = null"
        @save="handleEditSection"
      />
      <ContextMenu
        :visible="showContextMenu"
        :position="contextMenuPosition"
        :items="contextMenuItems"
        @close="showContextMenu = false"
        @select="handleMenuSelect"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/app'
import draggable from 'vuedraggable'
import TaskItem from './TaskItem.vue'
import TaskModal from './TaskModal.vue'
import SectionModal from './SectionModal.vue'
import ContextMenu from './ContextMenu.vue'

const props = defineProps({
  section: {
    type: Object,
    required: true
  }
})

const store = useAppStore()
const showNewTaskModal = ref(false)
const editingSection = ref(null)
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

const contextMenuItems = [
  { label: 'Edit', action: 'edit' },
  { label: 'Archive', action: 'archive' },
  { label: 'Delete', action: 'delete' }
]

const sectionTasks = computed(() => {
  return store.tasks[props.section.id] || []
})

function updateTasks(newTasks) {
  // Always update the store with the new task list
  // This handles both same-section reordering and cross-section moves
  store.tasks[props.section.id] = newTasks
}

async function handleCreateTask({ title, description, selectedLabels }) {
  const task = await store.createTask(props.section.id, title, description)

  // Add labels to the new task if any were selected
  if (selectedLabels && selectedLabels.length > 0) {
    for (const labelId of selectedLabels) {
      await store.addLabelToTask(task.id, labelId)
    }
  }

  showNewTaskModal.value = false
}

async function handleTaskDragEnd(event) {
  const { to, from, newIndex, oldIndex, item } = event

  // Check if task was moved to a different section
  if (to !== from) {
    // Get the task ID from the dragged element's data attribute
    const taskId = parseInt(item.dataset.taskId)

    // Get the section ID from the destination element
    const toSectionEl = to.closest('.section')
    const toSectionId = toSectionEl ? parseInt(toSectionEl.dataset.sectionId) : null

    if (toSectionId && taskId) {
      // Move task to new section in backend
      // The moveTaskToSection will sync with backend and update state
      await store.moveTaskToSection(taskId, toSectionId, newIndex)
    }
  } else {
    // Task was reordered within the same section
    const taskIds = sectionTasks.value.map(t => t.id)
    await store.reorderTasks(props.section.id, taskIds)
  }
}

function handleContextMenu(event) {
  const rect = event.target.getBoundingClientRect()
  contextMenuPosition.value = {
    x: rect.left,
    y: rect.bottom + 5
  }
  showContextMenu.value = true
}

async function handleEditSection(name) {
  if (editingSection.value) {
    await store.updateSection(editingSection.value.id, name)
    editingSection.value = null
  }
}

async function handleMenuSelect(item) {
  switch (item.action) {
    case 'edit':
      editingSection.value = props.section
      break
    case 'archive':
      await store.archiveSection(props.section.id)
      break
    case 'delete':
      if (confirm(`Delete section "${props.section.name}"?`)) {
        await store.deleteSection(props.section.id)
      }
      break
  }
}
</script>

<style scoped>
.section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  max-height: 600px;
  transition: all 0.3s ease;
}

.section.highlighted {
  background: #fff3cd;
  box-shadow: 0 0 0 3px #ffc107;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  cursor: grab;
  user-select: none;
}

.section-header:active {
  cursor: grabbing;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3436;
  text-transform: capitalize;
  margin: 0;
}

.section-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.menu-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #636e72;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
}

.menu-btn:hover {
  background: #dfe6e9;
  color: #2d3436;
}

.add-task-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: #dfe6e9;
  color: #636e72;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
}

.add-task-btn:hover {
  background: #a29bfe;
  color: white;
}

.tasks-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 2px;
  margin: -2px;
}

.add-task-link {
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: #636e72;
  font-size: 0.9rem;
  cursor: pointer;
  text-align: left;
  border-radius: 6px;
  transition: background 0.2s;
}

.add-task-link:hover {
  background: #e9ecef;
  color: #2d3436;
}
</style>
