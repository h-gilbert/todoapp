<template>
  <div class="main-content">
    <div class="content-header">
      <h1 v-if="store.currentProject">{{ store.currentProject.name }}</h1>
      <h1 v-else class="no-project-title">All Projects</h1>
      <SearchBar v-if="store.currentProject" />
      <div v-if="store.currentProject" class="header-actions">
        <button @click="showArchiveModal = true" class="archive-btn">
          Archive
        </button>
        <button @click="showNewSectionModal = true" class="add-section-btn">
          Add Section
        </button>
      </div>
    </div>

    <div v-if="!store.currentProject" class="empty-state">
      <h2>Select a project to get started</h2>
      <p>Choose a project from the sidebar or create a new one</p>
    </div>

    <div v-else class="project-view">

      <div class="sections-container">
        <draggable
          v-model="store.sections"
          @end="handleSectionReorder"
          item-key="id"
          class="sections-grid"
          handle=".section-header"
          animation="200"
          ghost-class="ghost-section"
          drag-class="dragging-section"
        >
          <template #item="{ element }">
            <Section :section="element" />
          </template>
        </draggable>
      </div>
    </div>

    <Teleport to="body">
      <SectionModal
        v-if="showNewSectionModal"
        @close="showNewSectionModal = false"
        @save="handleCreateSection"
      />

      <ArchiveModal
        v-if="showArchiveModal"
        @close="showArchiveModal = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '../stores/app'
import draggable from 'vuedraggable'
import Section from './Section.vue'
import SectionModal from './SectionModal.vue'
import ArchiveModal from './ArchiveModal.vue'
import SearchBar from './SearchBar.vue'

const store = useAppStore()
const showNewSectionModal = ref(false)
const showArchiveModal = ref(false)

async function handleCreateSection(name) {
  await store.createSection(name)
  showNewSectionModal.value = false
}

async function handleSectionReorder() {
  const sectionIds = store.sections.map(s => s.id)
  await store.reorderSections(sectionIds)
}
</script>

<style scoped>
.main-content {
  flex: 1;
  background: white;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #636e72;
}

.empty-state h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #2d3436;
}

.empty-state p {
  font-size: 1rem;
}

.project-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-header {
  padding: 2rem 2rem 1rem 2rem;
  border-bottom: 1px solid #e1e4e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  background: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.content-header h1 {
  font-size: 1.75rem;
  color: #2d3436;
  font-weight: 600;
  flex-shrink: 0;
}

.no-project-title {
  color: #636e72;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

.archive-btn {
  padding: 0.625rem 1.25rem;
  background: #dfe6e9;
  color: #2d3436;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.archive-btn:hover {
  background: #b2bec3;
}

.add-section-btn {
  padding: 0.625rem 1.25rem;
  background: #a29bfe;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.add-section-btn:hover {
  background: #6c5ce7;
}

.sections-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

.sections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
  align-items: start;
}

.ghost-section {
  opacity: 0.4;
  background: #a29bfe;
  border: 2px dashed #6c5ce7;
}

.dragging-section {
  opacity: 0.8;
  cursor: grabbing !important;
  transform: rotate(2deg);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}
</style>
