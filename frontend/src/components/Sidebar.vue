<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <UserDropdown />
    </div>

    <div class="projects-section">
      <GlobalSearch />

      <div class="section-header">
        <h2>My Projects</h2>
        <div class="header-actions">
          <button @click="triggerGlobalSearch" class="search-icon-btn" title="Search all projects">Search</button>
          <button @click="showNewProjectModal = true" class="add-button" title="Add Project">+</button>
        </div>
      </div>

      <draggable
        v-model="store.projects"
        @end="handleProjectReorder"
        item-key="id"
        class="projects-list"
      >
        <template #item="{ element }">
          <div
            class="project-item"
            :class="{ active: store.currentProject?.id === element.id, shared: element.is_owner === false }"
            :title="element.description || ''"
            @click="selectProject(element)"
            @contextmenu.prevent="handleContextMenu($event, element)"
          >
            <span class="project-name">
              <span v-if="element.is_owner === false" class="shared-badge" :title="'Shared by ' + element.owner_name">SHARED</span>
              <span v-if="element.is_owner === true && element.sharedWithCount > 0" class="sharing-badge" :title="'Shared with ' + element.sharedWithCount + ' user(s)'">SHARING</span>
              # {{ element.name }}
            </span>
            <span class="task-count">{{ element.taskCount || 0 }}</span>
          </div>
        </template>
      </draggable>
    </div>

    <Teleport to="body">
      <ProjectModal
        v-if="showNewProjectModal"
        @close="showNewProjectModal = false"
        @save="handleCreateProject"
      />

      <ProjectModal
        v-if="editingProject"
        :project="editingProject"
        @close="editingProject = null"
        @save="handleRenameProject"
      />

      <ShareModal
        :show="showShareModal"
        :project="sharingProject"
        @close="showShareModal = false"
      />

      <ContextMenu
        :visible="contextMenu.visible"
        :position="contextMenu.position"
        :items="contextMenuItems"
        @close="contextMenu.visible = false"
        @select="handleContextMenuSelect"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/app'
import draggable from 'vuedraggable'
import ProjectModal from './ProjectModal.vue'
import UserDropdown from './UserDropdown.vue'
import ContextMenu from './ContextMenu.vue'
import GlobalSearch from './GlobalSearch.vue'
import ShareModal from './ShareModal.vue'

const store = useAppStore()
const showNewProjectModal = ref(false)
const editingProject = ref(null)
const showShareModal = ref(false)
const sharingProject = ref(null)
const globalSearchComponent = ref(null)
const contextMenu = ref({
  visible: false,
  position: { x: 0, y: 0 },
  project: null
})

function triggerGlobalSearch() {
  const globalSearch = document.querySelector('.global-search-trigger')
  if (globalSearch) {
    globalSearch.click()
  }
}

const contextMenuItems = computed(() => {
  const project = contextMenu.value.project
  const items = []

  // Only owners can share and edit projects
  if (project?.is_owner) {
    items.push({ label: 'Share', action: 'share' })
    items.push({ label: 'Edit', action: 'rename' })
  }

  // Only owners can delete projects
  if (project?.is_owner) {
    items.push({ label: 'Delete', action: 'delete' })
  }

  return items
})

async function selectProject(project) {
  await store.selectProject(project)
}

async function handleCreateProject(projectData) {
  await store.createProject(projectData.name, projectData.description)
  showNewProjectModal.value = false
}

async function handleRenameProject(projectData) {
  if (editingProject.value) {
    await store.updateProject(editingProject.value.id, projectData.name, projectData.description)
    editingProject.value = null
  }
}

function handleContextMenu(event, project) {
  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    project
  }
}

async function handleContextMenuSelect(item) {
  const project = contextMenu.value.project

  if (item.action === 'share') {
    sharingProject.value = project
    showShareModal.value = true
  } else if (item.action === 'rename') {
    editingProject.value = project
  } else if (item.action === 'delete') {
    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
      await store.deleteProject(project.id)
    }
  }

  contextMenu.value.visible = false
}

async function handleProjectReorder() {
  const projectIds = store.projects.map(p => p.id)
  await store.reorderProjects(projectIds)
}
</script>

<style scoped>
.sidebar {
  width: 300px;
  background: #f8f9fa;
  border-right: 1px solid #e1e4e8;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid #e1e4e8;
}

.projects-section {
  padding: 1rem;
  flex: 1;
  position: relative;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #636e72;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.add-button {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: #a29bfe;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  line-height: 1;
  padding: 0;
}

.add-button:hover {
  background: #6c5ce7;
}

.search-icon-btn {
  height: 24px;
  border-radius: 6px;
  border: none;
  background: #dfe6e9;
  color: #636e72;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  line-height: 1;
  padding: 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.search-icon-btn:hover {
  background: #a29bfe;
  color: white;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.project-item {
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
  user-select: none;
}

.project-item:hover {
  background: #e9ecef;
}

.project-item.active {
  background: #ffeaa7;
  font-weight: 500;
}

.project-name {
  color: #2d3436;
  font-size: 0.9rem;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-count {
  color: #636e72;
  font-size: 0.85rem;
  font-weight: 500;
  background: white;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  min-width: 24px;
  text-align: center;
}

.project-item.active .task-count {
  background: #fdcb6e;
}

.project-item.shared {
  background: #e3f2fd;
}

.project-item.shared.active {
  background: #ffeaa7;
}

.shared-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 600;
  color: #1976d2;
  background: #bbdefb;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  margin-right: 0.375rem;
}

.sharing-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 600;
  color: #0288d1;
  background: #b3e5fc;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  margin-right: 0.375rem;
}
</style>
