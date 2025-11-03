<template>
  <div class="projects-container">
    <Sidebar />
    <MainContent />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAppStore } from '../stores/app'
import Sidebar from '../components/Sidebar.vue'
import MainContent from '../components/MainContent.vue'

const store = useAppStore()

onMounted(async () => {
  // If user is authenticated (from localStorage), load their projects
  if (store.user) {
    await store.loadProjects()
  }
})
</script>

<style scoped>
.projects-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
</style>
