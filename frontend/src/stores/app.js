import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_URL = '/api'

export const useAppStore = defineStore('app', () => {
  const user = ref(null)
  const csrfToken = ref(null)
  const projects = ref([])
  const currentProject = ref(null)
  const sections = ref([])
  const tasks = ref({})
  const photoCache = ref({})
  const labels = ref([])
  const taskLabels = ref({}) // taskId -> [labels]
  const subtasks = ref({}) // parentTaskId -> [subtasks]

  // Initialize user from localStorage on store creation (cookies handle tokens)
  const savedUser = localStorage.getItem('todo_user')
  if (savedUser) {
    try {
      user.value = JSON.parse(savedUser)
    } catch (e) {
      console.error('Failed to parse saved user', e)
      localStorage.removeItem('todo_user')
    }
  }

  // Fetch CSRF token from server
  async function fetchCsrfToken() {
    try {
      const response = await fetch(`${API_URL}/csrf-token`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        csrfToken.value = data.csrfToken
      }
    } catch (e) {
      console.error('Failed to fetch CSRF token', e)
    }
  }

  // Initialize CSRF token
  fetchCsrfToken()

  // Helper function to make authenticated requests
  async function authFetch(url, options = {}) {
    const headers = {
      ...options.headers
    }

    // Add CSRF token for state-changing requests
    if (csrfToken.value && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase())) {
      headers['X-CSRF-Token'] = csrfToken.value
    }

    // Don't set Content-Type for FormData (file uploads)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    }

    let response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Send cookies automatically
    })

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60'
      throw new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds and try again.`)
    }

    // If token expired, try to refresh
    if (response.status === 401 || response.status === 403) {
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include'
        })
      } else {
        // Refresh failed, logout user
        logout()
        throw new Error('Session expired')
      }
    }

    return response
  }

  // Try to refresh the access token
  async function tryRefreshToken() {
    try {
      const response = await fetch(`${API_URL}/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // Cookie will be sent automatically
      })

      if (!response.ok) return false

      // Refresh CSRF token after getting new access token
      await fetchCsrfToken()
      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  // User actions
  async function register(username, password) {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Registration failed')
    }

    const data = await response.json()
    user.value = data.user

    // Save only user info to localStorage (cookies handle tokens)
    localStorage.setItem('todo_user', JSON.stringify(user.value))

    // Fetch CSRF token for subsequent requests
    await fetchCsrfToken()

    await loadProjects()
    return user.value
  }

  async function login(username, password) {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    user.value = data.user

    // Save only user info to localStorage (cookies handle tokens)
    localStorage.setItem('todo_user', JSON.stringify(user.value))

    // Fetch CSRF token for subsequent requests
    await fetchCsrfToken()

    await loadProjects()
    return user.value
  }

  async function changePassword(currentPassword, newPassword) {
    const response = await authFetch(`${API_URL}/users/change-password`, {
      method: 'POST',
      body: JSON.stringify({
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

  async function logout() {
    // Notify server to invalidate refresh token and clear cookies
    try {
      await fetch(`${API_URL}/users/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken.value || ''
        },
        credentials: 'include'
      })
    } catch (e) {
      // Ignore errors during logout
    }

    user.value = null
    csrfToken.value = null
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
    const response = await authFetch(`${API_URL}/users/${user.value.id}/projects`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load projects')
    }

    if (!Array.isArray(data)) {
      throw new Error('Invalid response from server')
    }
    projects.value = data

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

  async function createProject(name, description = '') {
    const response = await authFetch(`${API_URL}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, description })
    })
    const project = await response.json()
    projects.value.push(project)
    return project
  }

  async function updateProject(id, name, description) {
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description

    const response = await authFetch(`${API_URL}/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
    const updated = await response.json()
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = { ...projects.value[index], ...updated }
    }
    return updated
  }

  async function deleteProject(id) {
    await authFetch(`${API_URL}/projects/${id}`, { method: 'DELETE' })
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProject.value?.id === id) {
      currentProject.value = null
      sections.value = []
      tasks.value = {}
      localStorage.removeItem('todo_current_project_id')
    }
  }

  async function archiveProject(id) {
    await authFetch(`${API_URL}/projects/${id}/archive`, { method: 'POST' })
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProject.value?.id === id) {
      currentProject.value = null
      sections.value = []
      tasks.value = {}
      localStorage.removeItem('todo_current_project_id')
    }
  }

  async function unarchiveProject(id) {
    await authFetch(`${API_URL}/projects/${id}/unarchive`, { method: 'POST' })
    // Reload projects to include the unarchived one
    await loadProjects()
  }

  async function loadArchivedProjects() {
    if (!user.value) return []
    const response = await authFetch(`${API_URL}/users/${user.value.id}/archived-projects`)
    return await response.json()
  }

  async function reorderProjects(projectIds) {
    await authFetch(`${API_URL}/projects/reorder`, {
      method: 'POST',
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
    const response = await authFetch(`${API_URL}/projects/${projectId}/sections`)
    sections.value = await response.json()

    // Load tasks for all sections
    for (const section of sections.value) {
      await loadTasks(section.id)
    }
  }

  async function createSection(name) {
    if (!currentProject.value) return
    const response = await authFetch(`${API_URL}/sections`, {
      method: 'POST',
      body: JSON.stringify({ projectId: currentProject.value.id, name })
    })
    const section = await response.json()
    sections.value.push(section)
    tasks.value[section.id] = []
    return section
  }

  async function updateSection(id, name) {
    const response = await authFetch(`${API_URL}/sections/${id}`, {
      method: 'PUT',
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
    // Count tasks being deleted
    const deletedTaskCount = tasks.value[id]?.length || 0

    await authFetch(`${API_URL}/sections/${id}`, { method: 'DELETE' })
    sections.value = sections.value.filter(s => s.id !== id)
    delete tasks.value[id]

    // Update project task count locally
    if (currentProject.value && deletedTaskCount > 0) {
      currentProject.value.taskCount = Math.max((currentProject.value.taskCount || 0) - deletedTaskCount, 0)
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].taskCount = currentProject.value.taskCount
      }
    }
  }

  async function reorderSections(sectionIds) {
    await authFetch(`${API_URL}/sections/reorder`, {
      method: 'POST',
      body: JSON.stringify({ sectionIds })
    })
  }

  async function archiveSection(id) {
    await authFetch(`${API_URL}/sections/${id}/archive`, {
      method: 'POST'
    })

    // Count tasks being archived
    const archivedTaskCount = tasks.value[id]?.length || 0

    // Remove from current sections
    sections.value = sections.value.filter(s => s.id !== id)
    delete tasks.value[id]

    // Update project task count locally
    if (currentProject.value && archivedTaskCount > 0) {
      currentProject.value.taskCount = Math.max((currentProject.value.taskCount || 0) - archivedTaskCount, 0)
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].taskCount = currentProject.value.taskCount
      }
    }
  }

  async function unarchiveSection(sectionId) {
    const response = await authFetch(`${API_URL}/sections/${sectionId}/unarchive`, {
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
      currentProject.value.taskCount = (currentProject.value.taskCount || 0) + unarchivedTaskCount
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].taskCount = currentProject.value.taskCount
      }
    }

    return section
  }

  // Task actions
  async function loadTasks(sectionId) {
    const response = await authFetch(`${API_URL}/sections/${sectionId}/tasks`)
    tasks.value[sectionId] = await response.json()
  }

  async function createTask(sectionId, title, description, parent_task_id = null) {
    const response = await authFetch(`${API_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ sectionId, title, description, parent_task_id })
    })
    const task = await response.json()

    // If this is a subtask, add to subtasks instead of main tasks
    if (parent_task_id) {
      if (!subtasks.value[parent_task_id]) {
        subtasks.value[parent_task_id] = []
      }
      subtasks.value[parent_task_id].push(task)
    } else {
      if (!tasks.value[sectionId]) {
        tasks.value[sectionId] = []
      }
      tasks.value[sectionId].push(task)
    }

    // Update project task count locally (only for non-subtasks)
    if (!parent_task_id && currentProject.value) {
      currentProject.value.taskCount = (currentProject.value.taskCount || 0) + 1
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].taskCount = currentProject.value.taskCount
      }
    }
    return task
  }

  async function updateTask(id, updates) {
    const response = await authFetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
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
    await authFetch(`${API_URL}/tasks/${id}/archive`, {
      method: 'POST'
    })

    // Remove from current tasks
    for (const sectionId in tasks.value) {
      tasks.value[sectionId] = tasks.value[sectionId].filter(t => t.id !== id)
    }

    // Update project task count locally
    if (currentProject.value) {
      currentProject.value.taskCount = Math.max((currentProject.value.taskCount || 0) - 1, 0)
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].taskCount = currentProject.value.taskCount
      }
    }
  }

  async function deleteTask(id) {
    await authFetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' })

    // Remove from current tasks
    for (const sectionId in tasks.value) {
      tasks.value[sectionId] = tasks.value[sectionId].filter(t => t.id !== id)
    }

    // Update project task count locally
    if (currentProject.value) {
      currentProject.value.taskCount = Math.max((currentProject.value.taskCount || 0) - 1, 0)
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].taskCount = currentProject.value.taskCount
      }
    }
  }

  async function moveTask(taskId, newSectionId) {
    const response = await authFetch(`${API_URL}/tasks/${taskId}/move`, {
      method: 'POST',
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
      const response = await authFetch(`${API_URL}/tasks/${taskId}/move`, {
        method: 'POST',
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
    await authFetch(`${API_URL}/tasks/reorder`, {
      method: 'POST',
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
    const response = await authFetch(`${API_URL}/projects/${currentProject.value.id}/archived`)
    return await response.json()
  }

  async function getArchivedSections() {
    if (!currentProject.value) return []
    const response = await authFetch(`${API_URL}/projects/${currentProject.value.id}/archived-sections`)
    return await response.json()
  }

  async function unarchiveTask(taskId) {
    const response = await authFetch(`${API_URL}/tasks/${taskId}/unarchive`, {
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
      currentProject.value.taskCount = (currentProject.value.taskCount || 0) + 1
      const projectIndex = projects.value.findIndex(p => p.id === currentProject.value.id)
      if (projectIndex !== -1) {
        projects.value[projectIndex].taskCount = currentProject.value.taskCount
      }
    }

    return task
  }

  // Search actions
  async function search(query) {
    if (!user.value || !query || query.trim().length === 0) return []

    const response = await authFetch(`${API_URL}/users/${user.value.id}/search?q=${encodeURIComponent(query)}`)
    return await response.json()
  }

  async function searchProject(projectId, query) {
    if (!query || query.trim().length === 0) return []

    const response = await authFetch(`${API_URL}/projects/${projectId}/search?q=${encodeURIComponent(query)}`)
    return await response.json()
  }

  // Photo actions
  async function uploadTaskPhotos(taskId, files) {
    const formData = new FormData()
    for (const file of files) {
      formData.append('photos', file)
    }

    const response = await authFetch(`${API_URL}/tasks/${taskId}/photos`, {
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

    const response = await authFetch(`${API_URL}/tasks/${taskId}/photos`)
    const photos = await response.json()

    // Cache the photos
    photoCache.value[taskId] = photos

    return photos
  }

  async function deletePhoto(photoId, taskId) {
    await authFetch(`${API_URL}/photos/${photoId}`, { method: 'DELETE' })

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
    const response = await authFetch(`${API_URL}/projects/${projectId}/share`, {
      method: 'POST',
      body: JSON.stringify({ username })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to share project')
    }

    return await response.json()
  }

  async function getProjectShares(projectId) {
    const response = await authFetch(`${API_URL}/projects/${projectId}/shares`)
    return await response.json()
  }

  async function removeProjectShare(projectId, shareUserId) {
    const response = await authFetch(`${API_URL}/projects/${projectId}/shares/${shareUserId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove share')
    }

    return await response.json()
  }

  // Label actions
  async function loadLabels() {
    if (!user.value) return
    const response = await authFetch(`${API_URL}/users/${user.value.id}/labels`)
    labels.value = await response.json()
  }

  async function createLabel(name, color = '#3B82F6') {
    const response = await authFetch(`${API_URL}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color })
    })
    const label = await response.json()
    labels.value.push(label)
    return label
  }

  async function updateLabel(id, updates) {
    const response = await authFetch(`${API_URL}/labels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
    const updated = await response.json()
    const index = labels.value.findIndex(l => l.id === id)
    if (index !== -1) {
      labels.value[index] = updated
    }
    return updated
  }

  async function deleteLabel(id) {
    await authFetch(`${API_URL}/labels/${id}`, { method: 'DELETE' })
    labels.value = labels.value.filter(l => l.id !== id)
    // Also remove from all tasks
    for (const taskId in taskLabels.value) {
      taskLabels.value[taskId] = taskLabels.value[taskId].filter(l => l.id !== id)
    }
  }

  async function getTaskLabels(taskId, forceRefresh = false) {
    if (!forceRefresh && taskLabels.value[taskId]) {
      return taskLabels.value[taskId]
    }
    const response = await authFetch(`${API_URL}/tasks/${taskId}/labels`)
    const taskLabelsList = await response.json()
    taskLabels.value[taskId] = taskLabelsList
    return taskLabelsList
  }

  async function addLabelToTask(taskId, labelId) {
    const response = await authFetch(`${API_URL}/tasks/${taskId}/labels/${labelId}`, {
      method: 'POST'
    })
    const result = await response.json()
    if (!taskLabels.value[taskId]) {
      taskLabels.value[taskId] = []
    }
    taskLabels.value[taskId].push(result.label)
    return result
  }

  async function removeLabelFromTask(taskId, labelId) {
    await authFetch(`${API_URL}/tasks/${taskId}/labels/${labelId}`, { method: 'DELETE' })
    if (taskLabels.value[taskId]) {
      taskLabels.value[taskId] = taskLabels.value[taskId].filter(l => l.id !== labelId)
    }
  }

  // Subtask actions
  async function loadSubtasks(parentTaskId, forceRefresh = false) {
    if (!forceRefresh && subtasks.value[parentTaskId]) {
      return subtasks.value[parentTaskId]
    }
    const response = await authFetch(`${API_URL}/tasks/${parentTaskId}/subtasks`)
    subtasks.value[parentTaskId] = await response.json()
    return subtasks.value[parentTaskId]
  }

  async function createSubtask(parentTaskId, title, description) {
    const response = await authFetch(`${API_URL}/tasks/${parentTaskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title, description })
    })
    const subtask = await response.json()
    if (!subtasks.value[parentTaskId]) {
      subtasks.value[parentTaskId] = []
    }
    subtasks.value[parentTaskId].push(subtask)
    return subtask
  }

  // Enhanced search with filters
  async function searchWithFilters(query, labelId = null) {
    if (!user.value || !query || query.trim().length === 0) return []

    let url = `${API_URL}/users/${user.value.id}/search?q=${encodeURIComponent(query)}`
    if (labelId) {
      url += `&labelId=${labelId}`
    }

    const response = await authFetch(url)
    return await response.json()
  }

  async function searchProjectWithFilters(projectId, query, labelId = null) {
    if (!query || query.trim().length === 0) return []

    let url = `${API_URL}/projects/${projectId}/search?q=${encodeURIComponent(query)}`
    if (labelId) {
      url += `&labelId=${labelId}`
    }

    const response = await authFetch(url)
    return await response.json()
  }

  return {
    user,
    projects,
    currentProject,
    sections,
    tasks,
    photoCache,
    labels,
    taskLabels,
    subtasks,
    register,
    login,
    changePassword,
    logout,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
    loadArchivedProjects,
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
    removeProjectShare,
    loadLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    getTaskLabels,
    addLabelToTask,
    removeLabelFromTask,
    loadSubtasks,
    createSubtask,
    searchWithFilters,
    searchProjectWithFilters
  }
})
