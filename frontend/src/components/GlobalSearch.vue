<template>
  <div>
    <button @click.stop="toggleSearch" class="global-search-trigger" style="display: none;"></button>

    <transition name="search-expand">
      <div v-if="isExpanded" class="search-overlay" @click.stop>
        <div class="search-header">
          <input
            ref="searchInput"
            type="text"
            v-model="searchQuery"
            @input="handleSearch"
            @click.stop
            placeholder="Search all projects..."
            class="global-search-input"
            autofocus
          />
          <button @click.stop="toggleSearch" class="close-search-btn" title="Close search">✕</button>
        </div>

        <div class="search-results-container">
          <div v-if="showResults && results.length > 0" class="global-search-results">
            <div
              v-for="result in results"
              :key="`${result.type}-${result.sectionId}-${result.taskId}`"
              @click.stop="navigateToResult(result)"
              class="global-search-result-item"
            >
              <div class="result-path">
                <span class="project-name">{{ result.projectName }}</span>
                <span class="separator">›</span>
                <span class="section-name">{{ result.sectionName }}</span>
                <span v-if="result.type === 'task'" class="separator">›</span>
                <span v-if="result.type === 'task'" class="task-indicator">Task</span>
              </div>
              <div class="result-title">
                {{ result.type === 'task' ? result.taskTitle : result.sectionName }}
              </div>
              <div v-if="result.description && result.description.trim()" class="result-description">
                {{ truncateDescription(result.description) }}
              </div>
            </div>
          </div>

          <div v-else-if="showResults && searchQuery && results.length === 0" class="no-results">
            No results found for "{{ searchQuery }}"
          </div>

          <div v-else-if="!searchQuery" class="search-prompt">
            Type to search across all projects...
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const isExpanded = ref(false);
const searchQuery = ref('');
const results = ref([]);
const showResults = ref(false);
const searchInput = ref(null);
let searchTimeout = null;

const toggleSearch = () => {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  } else {
    searchQuery.value = '';
    results.value = [];
    showResults.value = false;
  }
};

const handleSearch = () => {
  clearTimeout(searchTimeout);

  if (searchQuery.value.trim().length === 0) {
    results.value = [];
    showResults.value = false;
    return;
  }

  searchTimeout = setTimeout(async () => {
    showResults.value = true;
    results.value = await store.search(searchQuery.value);
  }, 300);
};

const truncateDescription = (desc) => {
  if (!desc) return '';
  return desc.length > 80 ? desc.substring(0, 80) + '...' : desc;
};

const navigateToResult = async (result) => {
  // Navigate to the project
  const project = store.projects.find(p => p.id === result.projectId);
  if (project) {
    await store.selectProject(project);

    // Close the search
    isExpanded.value = false;
    searchQuery.value = '';
    results.value = [];
    showResults.value = false;

    // Wait for sections to load and navigate
    setTimeout(() => {
      const sectionElement = document.querySelector(`[data-section-id="${result.sectionId}"]`);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sectionElement.classList.add('highlighted');
        setTimeout(() => {
          sectionElement.classList.remove('highlighted');
        }, 2000);

        if (result.type === 'task') {
          setTimeout(() => {
            const taskElement = document.querySelector(`[data-task-id="${result.taskId}"]`);
            if (taskElement) {
              taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              taskElement.classList.add('highlighted');
              setTimeout(() => {
                taskElement.classList.remove('highlighted');
              }, 2000);
            }
          }, 500);
        }
      }
    }, 100);
  }
};

// Close when clicking outside
const handleClickOutside = (event) => {
  const container = document.querySelector('.global-search-container');
  if (container && !container.contains(event.target)) {
    isExpanded.value = false;
    searchQuery.value = '';
    results.value = [];
    showResults.value = false;
  }
};

watch(() => isExpanded.value, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
});
</script>

<style scoped>
.search-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f8f9fa;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.search-header {
  padding: 1rem;
  border-bottom: 1px solid #e1e4e8;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  position: relative;
}

.close-search-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: #dfe6e9;
  color: #636e72;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}

.close-search-btn:hover {
  background: #b2bec3;
  color: #2d3436;
}

.global-search-input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: white;
}

.global-search-input:focus {
  border-color: #a29bfe;
  box-shadow: 0 0 0 3px rgba(162, 155, 254, 0.1);
}

.search-results-container {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.global-search-results {
  display: flex;
  flex-direction: column;
}

.global-search-result-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #e9ecef;
  transition: background-color 0.2s;
  background: transparent;
}

.global-search-result-item:hover {
  background-color: #e9ecef;
}

.result-path {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
}

.project-name {
  font-weight: 600;
  color: #a29bfe;
}

.section-name {
  color: #666;
}

.separator {
  color: #ccc;
}

.task-indicator {
  font-size: 10px;
  padding: 2px 6px;
  background-color: #dfe6e9;
  border-radius: 3px;
  color: #636e72;
}

.result-title {
  font-weight: 500;
  color: #2d3436;
  margin-bottom: 3px;
  font-size: 14px;
}

.result-description {
  font-size: 12px;
  color: #636e72;
  line-height: 1.4;
}

.no-results,
.search-prompt {
  padding: 3rem 2rem;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.search-prompt {
  color: #b2bec3;
}

/* Animation */
.search-expand-enter-active {
  animation: slideIn 0.3s ease-out;
}

.search-expand-leave-active {
  animation: slideOut 0.25s ease-in;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(20px);
  }
}
</style>
