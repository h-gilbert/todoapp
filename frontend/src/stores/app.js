import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_URL = '/api'

export const useAppStore = defineStore('app', () => {
  const user = ref(null)
  const projects = ref([])
  const currentProject = ref(null)
  const sections = ref([])
  const tasks = ref({})
  const photoCache = ref({})

  // Initialize user from localStorage on store creation
  const savedUser = localStorage.getItem('todo_user')
  if (savedUser) {
    try {
      user.value = JSON.parse(savedUser)
    } catch (e) {
      console.error('Failed to parse saved user', e)
      localStorage.removeItem('todo_user')
    }
  }

  // User actions
  async function register(username, password) {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Registration failed')
    }

    user.value = await response.json()

    // Save user to localStorage for persistence
    localStorage.setItem('todo_user', JSON.stringify(user.value))

    await loadProjects()
    return user.value
  }

  async function login(username, password) {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    user.value = await response.json()

    // Save user to localStorage for persistence
    localStorage.setItem('todo_user', JSON.stringify(user.value))

    await loadProjects()
    return user.value
  }

  async function changePassword(currentPassword, newPassword) {
    const response = await fetch(`${API_URL}/users/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.value.id,
        currentPassword,
        newPassword
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to change password')
    }

    return await response.json()
  }

  function logout() {
    user.value = null
    projects.value = []
    currentProject.value = null
    sections.value = []
    tasks.value = {}
    localStorage.removeItem('todo_user')
    localStorage.removeItem('todo_current_project_id')
  }

  // Project actions
  async function loadProjects() {
    if (!user.value) return
    const response = await fetch(`${API_URL}/users/${user.value.id}/projects`)
    projects.value = await response.json()

    // Restore last selected project if exists
    const savedProjectId = localStorage.getItem('todo_current_project_id')
    if (savedProjectId && !currentProject.value) {
      const project = projects.value.find(p => p.id === parseInt(savedProjectId))
      if (project) {
        await selectProject(project)
      } else {
        // Project no longer exists, clear from storage
        localStorage.removeItem('todo_current_project_id')
      }
    }
  }

  async function createProject(name) {
    const response = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.value.id, name })
    })
    const project = await response.json()
    projects.value.push(project)
    return project
  }

  async function updateProject(id, name) {
    const response = await fetch(`${API_URL}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    const updated = await response.json()
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = { ...projects.value[index], ...updated }
    }
    return updated
  }

  async function deleteProject(id) {
    await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' })
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProject.value?.id === id) {
      currentProject.value = null
      sections.value = []
      tasks.value = {}
      localStorage.removeItem('todo_current_project_id')
    }
  }

  async function reorderProjects(projectIds) {
    await fetch(`${API_URL}/projects/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectIds })
    })
  }

  async function selectProject(project) {
    currentProject.value = project
    // Save current project to localStorage for persistence
    localStorage.setItem('todo_current_project_id', project.id.toString())
    await loadSections(project.id)
  }

  // Section actions
  async function loadSections(projectId) {
    const response = await fetch(`${API_URL}/projects/${projectId}/sections`)
    sections.value = await response.json()

    // Load tasks for all sections
    for (const section of sections.value) {
      await loadTasks(section.id)
    }
  }

  async function createSection(name) {
    if (!currentProject.value) return
    const response = await fetch(`${API_URL}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: currentProject.value.id, name })
    })
    const section = await response.json()
    sections.value.push(section)
    tasks.value[section.id] = []
    return section
  }

  async function updateSection(id, name) {
    const response = await fetch(`${API_URL}/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    const updated = await response.json()
    const index = sections.value.findIndex(s => s.id === id)
    if (index !== -1) {
      sections.value[index] = { ...sections.value[index], ...updated }
    }
    return updated
  }

  async function deleteSection(id) {
    await fetch(`${API_URL}/sections/${id}`, { method: 'DELETE' })
    sections.value = sections.value.filter(s => s.id !== id)
    delete tasks.value[id]
  }

  async function reorderSections(sectionIds) {
    await fetch(`${API_URL}/sections/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionIds })
    })
  }

  async function archiveSection(id) {
    await fetch(`${API_URL}/sections/${id}/archive`, { method: 'POST' })

    // Count tasks being archived
    const archivedTaskCount = tasks.value[id]?.length || 0

    // Remove from current sections
    sections.value = sections.value.filter(s => s.id !== id)
    delete tasks.value[id]

    // Update project task count locally
    if (currentProject.value && archivedTaskCount > 0) {
      currentProject.value.task_count = Math.max((currentProject.value.task_count || 0) - archivedTaskCount, 0)
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].task_count = currentProject.value.task_count
      }
    }
  }

  async function unarchiveSection(sectionId) {
    const response = await fetch(`${API_URL}/sections/${sectionId}/unarchive`, {
      method: 'POST'
    })
    const section = await response.json()

    // Add back to sections
    sections.value.push(section)
    tasks.value[section.id] = []

    // Load tasks for the section
    await loadTasks(section.id)

    // Update project task count locally
    const unarchivedTaskCount = tasks.value[section.id]?.length || 0
    if (currentProject.value && unarchivedTaskCount > 0) {
      currentProject.value.task_count = (currentProject.value.task_count || 0) + unarchivedTaskCount
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].task_count = currentProject.value.task_count
      }
    }

    return section
  }

  // Task actions
  async function loadTasks(sectionId) {
    const response = await fetch(`${API_URL}/sections/${sectionId}/tasks`)
    tasks.value[sectionId] = await response.json()
  }

  async function createTask(sectionId, title, description) {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, title, description })
    })
    const task = await response.json()
    if (!tasks.value[sectionId]) {
      tasks.value[sectionId] = []
    }
    tasks.value[sectionId].push(task)

    // Update project task count locally
    if (currentProject.value) {
      currentProject.value.task_count = (currentProject.value.task_count || 0) + 1
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].task_count = currentProject.value.task_count
      }
    }
    return task
  }

  async function updateTask(id, updates) {
    const response = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    const updated = await response.json()

    // Find and update the task
    for (const sectionId in tasks.value) {
      const index = tasks.value[sectionId].findIndex(t => t.id === id)
      if (index !== -1) {
        tasks.value[sectionId][index] = updated
        break
      }
    }

    return updated
  }

  async function toggleTaskComplete(id, completed, autoArchive = true, programmatic_completion = false) {
    await updateTask(id, { completed, programmatic_completion })
    if (completed && autoArchive) {
      // Archive completed task after a short delay
      setTimeout(async () => {
        await archiveTask(id)
      }, 500)
    }
  }

  async function archiveTask(id) {
    await fetch(`${API_URL}/tasks/${id}/archive`, { method: 'POST' })

    // Remove from current tasks
    for (const sectionId in tasks.value) {
      tasks.value[sectionId] = tasks.value[sectionId].filter(t => t.id !== id)
    }

    // Update project task count locally
    if (currentProject.value) {
      currentProject.value.task_count = Math.max((currentProject.value.task_count || 0) - 1, 0)
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].task_count = currentProject.value.task_count
      }
    }
  }

  async function deleteTask(id) {
    await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' })

    // Remove from current tasks
    for (const sectionId in tasks.value) {
      tasks.value[sectionId] = tasks.value[sectionId].filter(t => t.id !== id)
    }

    // Update project task count locally
    if (currentProject.value) {
      currentProject.value.task_count = Math.max((currentProject.value.task_count || 0) - 1, 0)
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].task_count = currentProject.value.task_count
      }
    }
  }

  async function moveTask(taskId, newSectionId) {
    const response = await fetch(`${API_URL}/tasks/${taskId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: newSectionId })
    })
    const updated = await response.json()

    // Remove from old section
    for (const sectionId in tasks.value) {
      const index = tasks.value[sectionId].findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value[sectionId].splice(index, 1)
        break
      }
    }

    // Add to new section
    if (!tasks.value[newSectionId]) {
      tasks.value[newSectionId] = []
    }
    tasks.value[newSectionId].push(updated)

    return updated
  }

  async function moveTaskToSection(taskId, newSectionId, targetIndex) {
    // Call API to move task first
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: newSectionId, targetIndex })
      })

      if (!response.ok) {
        throw new Error('Failed to move task')
      }

      const updated = await response.json()

      // After successful API call, reload both sections to ensure consistency
      // Find which section the task came from
      let oldSectionId = null
      for (const sectionId in tasks.value) {
        if (tasks.value[sectionId].some(t => t.id === taskId)) {
          oldSectionId = sectionId
          break
        }
      }

      // Reload both affected sections
      if (oldSectionId && oldSectionId !== newSectionId.toString()) {
        await loadTasks(oldSectionId)
      }
      await loadTasks(newSectionId)

      return updated
    } catch (error) {
      console.error('Error moving task:', error)
      // On error, reload both sections to revert to server state
      await loadTasks(newSectionId)
      throw error
    }
  }

  async function reorderTasks(sectionId, taskIds) {
    await fetch(`${API_URL}/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds })
    })

    // Update local state
    const newOrder = taskIds.map(id =>
      tasks.value[sectionId].find(t => t.id === id)
    ).filter(Boolean)
    tasks.value[sectionId] = newOrder
  }

  async function getArchivedTasks() {
    if (!currentProject.value) return []
    const response = await fetch(`${API_URL}/projects/${currentProject.value.id}/archived`)
    return await response.json()
  }

  async function getArchivedSections() {
    if (!currentProject.value) return []
    const response = await fetch(`${API_URL}/projects/${currentProject.value.id}/archived-sections`)
    return await response.json()
  }

  async function unarchiveTask(taskId) {
    const response = await fetch(`${API_URL}/tasks/${taskId}/unarchive`, {
      method: 'POST'
    })
    const task = await response.json()

    // Add back to the section's tasks
    if (!tasks.value[task.section_id]) {
      tasks.value[task.section_id] = []
    }
    tasks.value[task.section_id].push(task)

    // Update project task count locally
    if (currentProject.value) {
      currentProject.value.task_count = (currentProject.value.task_count || 0) + 1
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].task_count = currentProject.value.task_count
      }
    }

    return task
  }

  // Search actions
  async function search(query) {
    if (!user.value || !query || query.trim().length === 0) return []

    const response = await fetch(`${API_URL}/users/${user.value.id}/search?q=${encodeURIComponent(query)}`)
    return await response.json()
  }

  async function searchProject(projectId, query) {
    if (!query || query.trim().length === 0) return []

    const response = await fetch(`${API_URL}/projects/${projectId}/search?q=${encodeURIComponent(query)}`)
    return await response.json()
  }

  // Photo actions
  async function uploadTaskPhotos(taskId, files) {
    const formData = new FormData()
    for (const file of files) {
      formData.append('photos', file)
    }

    const response = await fetch(`${API_URL}/tasks/${taskId}/photos`, {
      method: 'POST',
      body: formData
    })
    return await response.json()
  }

  async function getTaskPhotos(taskId, forceRefresh = false) {
    // Return cached photos if available and not forcing refresh
    if (!forceRefresh && photoCache.value[taskId]) {
      return photoCache.value[taskId]
    }

    const response = await fetch(`${API_URL}/tasks/${taskId}/photos`)
    const photos = await response.json()

    // Cache the photos
    photoCache.value[taskId] = photos

    return photos
  }

  async function deletePhoto(photoId, taskId) {
    await fetch(`${API_URL}/photos/${photoId}`, { method: 'DELETE' })

    // Invalidate cache for this task
    if (photoCache.value[taskId]) {
      delete photoCache.value[taskId]
    }
  }

  async function invalidatePhotoCache(taskId) {
    if (photoCache.value[taskId]) {
      delete photoCache.value[taskId]
    }
  }

  // Project sharing actions
  async function shareProject(projectId, username) {
    const response = await fetch(`${API_URL}/projects/${projectId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, userId: user.value.id })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to share project')
    }

    return await response.json()
  }

  async function getProjectShares(projectId) {
    const response = await fetch(`${API_URL}/projects/${projectId}/shares`)
    return await response.json()
  }

  async function removeProjectShare(projectId, shareUserId) {
    const response = await fetch(`${API_URL}/projects/${projectId}/shares/${shareUserId}?userId=${user.value.id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove share')
    }

    return await response.json()
  }

  return {
    user,
    projects,
    currentProject,
    sections,
    tasks,
    photoCache,
    register,
    login,
    changePassword,
    logout,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    reorderProjects,
    selectProject,
    loadSections,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    archiveSection,
    unarchiveSection,
    loadTasks,
    createTask,
    updateTask,
    toggleTaskComplete,
    archiveTask,
    deleteTask,
    moveTask,
    moveTaskToSection,
    reorderTasks,
    getArchivedTasks,
    getArchivedSections,
    unarchiveTask,
    search,
    searchProject,
    uploadTaskPhotos,
    getTaskPhotos,
    deletePhoto,
    invalidatePhotoCache,
    shareProject,
    getProjectShares,
    removeProjectShare
  }
})
