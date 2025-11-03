<template>
  <div class="search-container">
    <div class="search-input-wrapper">
      <input
        type="text"
        v-model="searchQuery"
        @input="handleSearch"
        :placeholder="store.currentProject ? `Search in ${store.currentProject.name}...` : 'Search current project...'"
        class="search-input"
      />
      <span v-if="searchQuery" @click="clearSearch" class="clear-button">×</span>
    </div>

    <div v-if="showResults && results.length > 0" class="search-results">
      <div
        v-for="result in results"
        :key="`${result.type}-${result.sectionId}-${result.taskId}`"
        @click="navigateToResult(result)"
        class="search-result-item"
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

    <div v-if="showResults && searchQuery && results.length === 0" class="no-results">
      No results found for "{{ searchQuery }}"
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const searchQuery = ref('');
const results = ref([]);
const showResults = ref(false);
let searchTimeout = null;

const handleSearch = () => {
  // Debounce search
  clearTimeout(searchTimeout);

  if (searchQuery.value.trim().length === 0) {
    results.value = [];
    showResults.value = false;
    return;
  }

  searchTimeout = setTimeout(async () => {
    showResults.value = true;
    // Use project-scoped search if a project is selected
    if (store.currentProject) {
      results.value = await store.searchProject(store.currentProject.id, searchQuery.value);
    } else {
      results.value = [];
    }
  }, 300);
};

const clearSearch = () => {
  searchQuery.value = '';
  results.value = [];
  showResults.value = false;
};

const truncateDescription = (desc) => {
  if (!desc) return '';
  return desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
};

const navigateToResult = async (result) => {
  // Close the search results first
  clearSearch();

  // Wait a bit for sections to be ready
  setTimeout(() => {
    // Scroll to the section
    const sectionElement = document.querySelector(`[data-section-id="${result.sectionId}"]`);
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight the section briefly
      sectionElement.classList.add('highlighted');
      setTimeout(() => {
        sectionElement.classList.remove('highlighted');
      }, 2000);

      // If it's a task, highlight the task too
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
};

// Close results when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.search-container')) {
    showResults.value = false;
  }
};

watch(() => showResults.value, (newVal) => {
  if (newVal) {
    document.addEventListener('click', handleClickOutside);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
});
</script>

<style scoped>
.search-container {
  position: relative;
  width: 100%;
  max-width: 600px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.clear-button {
  position: absolute;
  right: 15px;
  cursor: pointer;
  font-size: 24px;
  color: #999;
  user-select: none;
  line-height: 1;
}

.clear-button:hover {
  color: #333;
}

.search-results {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
}

.search-result-item {
  padding: 12px 15px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: #f8f9fa;
}

.result-path {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.project-name {
  font-weight: 600;
  color: #007bff;
}

.section-name {
  color: #666;
}

.separator {
  color: #ccc;
}

.task-indicator {
  font-size: 11px;
  padding: 2px 6px;
  background-color: #e9ecef;
  border-radius: 3px;
  color: #495057;
}

.result-title {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  font-size: 14px;
}

.result-description {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.no-results {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}
</style>
