# Todo-App Enhancement: Bug Tracking & Feature Management Platform
## Progress Documentation - November 6, 2025

---

## 📋 Project Overview

**Objective:** Extend the existing todo-app into a comprehensive bug tracking, feature tracking, and idea management platform.

**Key Requirements:**
- Task type classification (Task, Bug, Feature, Idea)
- Nested tasks (2-level: Tasks → Subtasks)
- Flexible labeling/tagging system
- Enhanced file uploads (support documents, logs, PDFs)
- User → Projects → Sections → Tasks → Subtasks hierarchy

---

## ✅ COMPLETED WORK

### Phase 1: Database Schema Extensions (100% Complete)

**File:** `/backend/database.js` (lines 132-303)

**New Tables & Columns:**

1. **Tasks Table Enhancements:**
   - `type` column: TEXT with CHECK constraint ('task', 'bug', 'feature', 'idea')
   - `parent_task_id` column: INTEGER (self-referencing FK for 2-level nesting)
   - Validation: Prevents nesting beyond 2 levels

2. **Labels Table:** (NEW)
   ```sql
   CREATE TABLE labels (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     color TEXT NOT NULL DEFAULT '#3B82F6',
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     UNIQUE(user_id, name)
   )
   ```

3. **Task_Labels Junction Table:** (NEW)
   ```sql
   CREATE TABLE task_labels (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     task_id INTEGER NOT NULL,
     label_id INTEGER NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     UNIQUE(task_id, label_id)
   )
   ```

4. **API_Tokens Table:** (NEW)
   ```sql
   CREATE TABLE api_tokens (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL,
     token TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL,
     scopes TEXT NOT NULL DEFAULT 'read',
     expires_at DATETIME,
     last_used_at DATETIME,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )
   ```

**Performance Indexes Added:**
- `idx_tasks_type`
- `idx_tasks_parent_task_id`
- `idx_tasks_section_type`
- `idx_labels_user_id`
- `idx_task_labels_task_id`
- `idx_task_labels_label_id`
- `idx_api_tokens_user_id`
- `idx_api_tokens_token`

---

### Phase 2: Backend API Implementation (100% Complete)

**File:** `/backend/server.js`

#### 2.1 Task Type & Subtask Endpoints

**Updated Endpoints:**
- `POST /api/tasks` - Now accepts `type` and `parent_task_id`
  - Validates task type (task/bug/feature/idea)
  - Validates parent exists and prevents 3+ level nesting
  - Returns task with `subtask_count`

- `PUT /api/tasks/:id` - Now accepts `type` and `parent_task_id`
  - Updates task type
  - Can move task to be a subtask (or remove parent)
  - Prevents circular references

- `GET /api/sections/:sectionId/tasks` - Enhanced to:
  - Exclude subtasks (parent_task_id IS NULL)
  - Include `subtask_count` for each task
  - Include `completed_subtask_count` for progress tracking

**New Endpoints:**
- `GET /api/tasks/:id/subtasks` - Get all subtasks for a parent task
- `POST /api/tasks/:id/subtasks` - Create subtask (convenience endpoint)
  - Auto-validates 2-level limit
  - Inherits section from parent

#### 2.2 Labels/Tags API (8 endpoints)

**Label Management:**
- `GET /api/users/:userId/labels` - Get all user labels
- `POST /api/labels` - Create label (userId, name, color)
- `PUT /api/labels/:id` - Update label (name, color)
- `DELETE /api/labels/:id` - Delete label (cascade deletes task associations)

**Task Label Associations:**
- `GET /api/tasks/:id/labels` - Get labels for a task (with JOIN)
- `POST /api/tasks/:taskId/labels/:labelId` - Add label to task
- `DELETE /api/tasks/:taskId/labels/:labelId` - Remove label from task

#### 2.3 Enhanced Search & Filtering

**Updated Endpoints:**
- `GET /api/users/:userId/search?q=<query>&taskType=<type>&labelId=<id>`
  - Filter by task type (bug/feature/idea/task)
  - Filter by label
  - Returns results with `taskType` field

- `GET /api/projects/:projectId/search?q=<query>&taskType=<type>&labelId=<id>`
  - Project-scoped search with same filters

**New Filter Endpoints:**
- `GET /api/projects/:projectId/bugs` - Get all bug-type tasks
- `GET /api/projects/:projectId/features` - Get all feature-type tasks
- `GET /api/projects/:projectId/ideas` - Get all idea-type tasks

#### 2.4 File Upload Extensions

**File:** `/backend/server.js` (lines 30-47)

**Extended Multer Config:**
- Old: Only images (jpeg, jpg, png, gif, webp)
- New: Added support for:
  - Documents: PDF, TXT, MD
  - Logs: LOG
  - Data: JSON, XML, CSV
  - Archives: ZIP, TAR, GZ
- Limit: 10MB per file, 5 files per task

#### 2.5 API Token Authentication

**File:** `/backend/server.js` (lines 120-170, 443-532)

**Token Generation:**
- `POST /api/users/:userId/tokens` - Generate API token
  - Parameters: name, scopes, expiresInDays
  - Returns: Full token record (only time token value is visible)
  - Generates 64-char hex token via crypto.randomBytes(32)

**Token Management:**
- `GET /api/users/:userId/tokens` - List user's tokens (token value hidden)
- `DELETE /api/tokens/:id` - Revoke token

**Authentication Middleware:**
- `authenticateToken()` middleware at line 127
- Supports Bearer token in Authorization header
- Updates `last_used_at` on each request
- Checks expiration
- Attaches `req.userId`, `req.tokenScopes`, `req.authenticatedViaToken`
- Applied to all `/api/*` routes (line 322)

---

### Phase 3: Frontend Implementation (70% Complete)

#### 3.1 Pinia Store Updates (100% Complete)

**File:** `/frontend/src/stores/app.js`

**New State:**
```javascript
const labels = ref([])           // All user labels
const taskLabels = ref({})       // taskId -> [labels]
const subtasks = ref({})         // parentTaskId -> [subtasks]
```

**Updated Actions:**
- `createTask()` - Now accepts `type` and `parent_task_id` parameters
- `updateTask()` - Handles type updates

**New Label Actions:**
- `loadLabels()` - Fetch all user labels
- `createLabel(name, color)` - Create label
- `updateLabel(id, updates)` - Update label
- `deleteLabel(id)` - Delete label
- `getTaskLabels(taskId)` - Get labels for task (cached)
- `addLabelToTask(taskId, labelId)` - Associate label
- `removeLabelFromTask(taskId, labelId)` - Remove association

**New Subtask Actions:**
- `loadSubtasks(parentTaskId)` - Fetch subtasks (cached)
- `createSubtask(parentTaskId, title, description, type)` - Create subtask

**Enhanced Search:**
- `searchWithFilters(query, taskType, labelId)` - Global search with filters
- `searchProjectWithFilters(projectId, query, taskType, labelId)` - Project search
- `getBugs(projectId)` - Shortcut to get all bugs
- `getFeatures(projectId)` - Shortcut to get features
- `getIdeas(projectId)` - Shortcut to get ideas

#### 3.2 TaskModal Component (100% Complete)

**File:** `/frontend/src/components/TaskModal.vue`

**New UI Elements:**

1. **Task Type Selector** (lines 25-34)
   - Dropdown with 4 options: 📋 Task, 🐛 Bug, ✨ Feature, 💡 Idea
   - Defaults to 'task'
   - Persists selection on edit

2. **Label Selection** (lines 35-50)
   - Multi-select chips for all available labels
   - Color-coded (uses label.color)
   - Selected labels have filled background
   - Only shows if labels exist

3. **Subtasks Section** (lines 52-93)
   - Shows list of existing subtasks with checkboxes
   - Displays progress: "Subtasks (2/5)"
   - "Add Subtask" button (only for existing tasks)
   - Inline subtask creation form
   - Real-time completion toggle

**New State & Logic:**
```javascript
const taskType = ref(props.task?.type || 'task')
const selectedLabels = ref([])  // Array of label IDs
const subtasksList = ref([])
const showAddSubtask = ref(false)
const newSubtaskTitle = ref('')
```

**New Functions:**
- `toggleLabel(labelId)` - Toggle label selection
- `handleAddSubtask()` - Create subtask via API
- `handleToggleSubtask(subtaskId, completed)` - Update subtask completion

**Data Loading:**
- On mount: Loads photos, task labels, and subtasks for existing tasks
- Passes `type` and `selectedLabels` in save event

**Styling:** (lines 628-748)
- Form row grid layout for type/labels
- Label chip styling with hover effects
- Subtask list styling with completion states
- Add subtask form styling

#### 3.3 Component Updates for New Fields

**Section.vue** (lines 89-100)
- Updated `handleCreateTask()` to accept type and selectedLabels
- Loops through selectedLabels to add associations after task creation

**TaskItem.vue** (lines 74-96)
- Updated `handleUpdate()` to accept type and selectedLabels
- Syncs labels: adds new, removes deselected
- Force refreshes task labels on each edit

---

## 🚧 REMAINING WORK

### Phase 3: Frontend Visual Polish (30% remaining)

#### 3.3 Add Task Type & Label Badges to TaskItem

**File to Update:** `/frontend/src/components/TaskItem.vue`

**Requirements:**
1. Show task type icon before task title:
   - 📋 for 'task' (or no icon)
   - 🐛 for 'bug' (red/pink color)
   - ✨ for 'feature' (blue/purple color)
   - 💡 for 'idea' (yellow/amber color)

2. Display label chips below task title:
   - Small colored badges with label names
   - Use label.color for background
   - Limit to 3 visible + "and X more"
   - Click to filter by label (future enhancement)

3. Show subtask progress indicator:
   - Small badge showing "2/5" if subtasks exist
   - Different color if all completed

**Implementation Steps:**
```vue
<!-- Add to template after task title -->
<div class="task-badges">
  <span v-if="task.type && task.type !== 'task'"
        class="type-badge"
        :class="`type-${task.type}`">
    {{ getTypeIcon(task.type) }}
  </span>

  <div v-if="taskLabels[task.id]" class="task-labels">
    <span v-for="label in taskLabels[task.id].slice(0, 3)"
          :key="label.id"
          class="label-badge"
          :style="{ backgroundColor: label.color }">
      {{ label.name }}
    </span>
    <span v-if="taskLabels[task.id].length > 3" class="more-labels">
      +{{ taskLabels[task.id].length - 3 }}
    </span>
  </div>

  <span v-if="task.subtask_count > 0" class="subtask-badge">
    {{ task.completed_subtask_count }}/{{ task.subtask_count }}
  </span>
</div>

<script>
function getTypeIcon(type) {
  const icons = {
    bug: '🐛',
    feature: '✨',
    idea: '💡'
  }
  return icons[type] || ''
}

// Load labels on mount
onMounted(async () => {
  if (props.task.id) {
    await store.getTaskLabels(props.task.id)
  }
})
</script>

<style>
.type-badge {
  font-size: 1.1rem;
  margin-right: 0.25rem;
}

.type-bug { filter: hue-rotate(350deg); }
.type-feature { filter: hue-rotate(200deg); }
.type-idea { filter: hue-rotate(45deg); }

.task-labels {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.label-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.7rem;
  color: white;
  font-weight: 500;
}

.subtask-badge {
  padding: 0.15rem 0.4rem;
  background: #dfe6e9;
  border-radius: 8px;
  font-size: 0.7rem;
  color: #636e72;
  font-weight: 500;
}
</style>
```

#### 3.4 Create LabelManagerModal Component

**New File:** `/frontend/src/components/LabelManagerModal.vue`

**Purpose:** Dedicated UI for creating, editing, and deleting labels

**Features:**
1. List all user labels with color preview
2. Create new label with name + color picker
3. Edit existing label (change name/color)
4. Delete label with confirmation
5. Show usage count (how many tasks use each label)

**Template Structure:**
```vue
<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h2>Manage Labels</h2>

      <!-- Create new label -->
      <div class="create-label">
        <input v-model="newLabelName" placeholder="Label name" />
        <input v-model="newLabelColor" type="color" />
        <button @click="handleCreate">Create</button>
      </div>

      <!-- Label list -->
      <div class="labels-list">
        <div v-for="label in store.labels" :key="label.id" class="label-row">
          <span class="color-preview" :style="{ backgroundColor: label.color }"></span>
          <input v-if="editingId === label.id" v-model="editName" />
          <span v-else>{{ label.name }}</span>
          <input v-if="editingId === label.id" v-model="editColor" type="color" />
          <div class="actions">
            <button v-if="editingId === label.id" @click="handleSaveEdit(label.id)">Save</button>
            <button v-else @click="startEdit(label)">Edit</button>
            <button @click="handleDelete(label.id)">Delete</button>
          </div>
        </div>
      </div>

      <button @click="$emit('close')" class="btn-close">Close</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const emit = defineEmits(['close'])

const newLabelName = ref('')
const newLabelColor = ref('#3B82F6')
const editingId = ref(null)
const editName = ref('')
const editColor = ref('')

async function handleCreate() {
  if (!newLabelName.value.trim()) return
  await store.createLabel(newLabelName.value.trim(), newLabelColor.value)
  newLabelName.value = ''
  newLabelColor.value = '#3B82F6'
}

function startEdit(label) {
  editingId.value = label.id
  editName.value = label.name
  editColor.value = label.color
}

async function handleSaveEdit(id) {
  await store.updateLabel(id, { name: editName.value, color: editColor.value })
  editingId.value = null
}

async function handleDelete(id) {
  if (confirm('Delete this label? It will be removed from all tasks.')) {
    await store.deleteLabel(id)
  }
}
</script>
```

**Where to Add:**
- Import in `/frontend/src/components/Sidebar.vue`
- Add button in user dropdown or settings area
- Show modal when clicked

#### 3.5 Update Sidebar to Load Labels

**File:** `/frontend/src/components/Sidebar.vue`

**Required Changes:**

1. Load labels after successful login:
```javascript
// In login handler or onMounted
async function handleLogin() {
  // ... existing login code
  await store.login(username, password)
  await store.loadLabels()  // ADD THIS
  // ... rest of code
}
```

2. Add "Manage Labels" button to user dropdown
3. Show LabelManagerModal when clicked

---

## 📦 DEPLOYMENT STATUS

### Current Deployment (Local Docker)

**Services Running:**
- ✅ Backend: `local-todo-app-backend` on port 3300
- ✅ Frontend: Served by `local-multi-site-nginx` on port 8080
- ✅ Database: SQLite in volume `todo-app-data`
- ✅ Uploads: Persisted in volume `todo-app-uploads`

**Access URL:** http://todo.hamishgilbert.test:8080

**Database Migrations Applied:**
```
✓ type column added to tasks table
✓ parent_task_id column added to tasks table
✓ labels table created
✓ task_labels table created
✓ api_tokens table created
✓ All indexes created
```

**Rebuild Commands:**
```bash
# Frontend
cd /Users/hamishgilbert/Downloads/Projects/todo-app/frontend
npm run build

# Backend (in local-dev-environment)
cd /Users/hamishgilbert/Downloads/Projects/local-dev-environment
docker-compose stop local-todo-app-backend
docker-compose rm -f local-todo-app-backend
docker-compose up -d --build local-todo-app-backend
docker-compose restart local-multi-site-nginx
```

---

## 🧪 TESTING GUIDE

### What Currently Works

1. **Task Type Selection:**
   - Open TaskModal
   - Select type: 📋 Task, 🐛 Bug, ✨ Feature, 💡 Idea
   - Type persists on create/edit

2. **Subtasks:**
   - Edit any existing task
   - Click "+ Add Subtask"
   - Add subtask title
   - Toggle completion checkboxes
   - See progress counter

3. **Labels (Partially):**
   - Labels show in TaskModal IF they exist
   - Can select/deselect during create/edit
   - Labels save to database
   - **BUT:** No UI to create labels yet (need LabelManagerModal)

### How to Test Labels Now

**Create a label via API:**
```bash
curl -X POST http://localhost:3300/api/labels \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "name": "urgent", "color": "#FF0000"}'

curl -X POST http://localhost:3300/api/labels \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "name": "frontend", "color": "#3B82F6"}'

curl -X POST http://localhost:3300/api/labels \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "name": "backend", "color": "#00B894"}'
```

**Then refresh app and labels will appear in TaskModal!**

### Backend API Testing

**Test task type filtering:**
```bash
# Get all bugs in a project
curl http://localhost:3300/api/projects/1/bugs?userId=1

# Get all features
curl http://localhost:3300/api/projects/1/features?userId=1

# Search with type filter
curl "http://localhost:3300/api/users/1/search?q=login&taskType=bug"
```

**Test subtasks:**
```bash
# Create a subtask
curl -X POST http://localhost:3300/api/tasks/5/subtasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test database connection", "description": "Verify DB works"}'

# Get subtasks
curl http://localhost:3300/api/tasks/5/subtasks
```

**Test label associations:**
```bash
# Add label to task
curl -X POST http://localhost:3300/api/tasks/5/labels/1

# Get task labels
curl http://localhost:3300/api/tasks/5/labels

# Remove label
curl -X DELETE http://localhost:3300/api/tasks/5/labels/1
```

**Generate API token:**
```bash
curl -X POST http://localhost:3300/api/users/1/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Access",
    "scopes": "read,write",
    "expiresInDays": 365
  }'
```

---

## 📊 COMPLETION STATUS

| Phase | Component | Status | Time Est. |
|-------|-----------|--------|-----------|
| **1** | Database Schema | ✅ 100% | - |
| **2.1** | Task Types & Subtasks API | ✅ 100% | - |
| **2.2** | Labels API | ✅ 100% | - |
| **2.3** | Search & Filtering | ✅ 100% | - |
| **2.4** | File Upload Extensions | ✅ 100% | - |
| **2.5** | API Token Auth | ✅ 100% | - |
| **3.1** | Pinia Store | ✅ 100% | - |
| **3.2** | TaskModal UI | ✅ 100% | - |
| **3.3** | TaskItem Badges | ⏳ 0% | 30 min |
| **3.4** | LabelManagerModal | ⏳ 0% | 45 min |
| **3.5** | Sidebar Label Loading | ⏳ 0% | 15 min |

**Overall: 80% Complete**

---

## 🚀 NEXT SESSION PRIORITIES

### Complete Visual Polish
1. Add badges to TaskItem (30 min)
2. Create LabelManagerModal (45 min)
3. Update Sidebar (15 min)
4. Test full workflow end-to-end

**Deliverable:** Fully functional UI with all features visible

---

## 📁 KEY FILES MODIFIED

**Backend:**
- `/backend/database.js` - Schema + migrations
- `/backend/server.js` - All API endpoints

**Frontend:**
- `/frontend/src/stores/app.js` - Store with new actions
- `/frontend/src/components/TaskModal.vue` - Enhanced UI
- `/frontend/src/components/Section.vue` - Create handler
- `/frontend/src/components/TaskItem.vue` - Update handler

**Not Yet Created:**
- `/frontend/src/components/LabelManagerModal.vue`

---

## 🎯 ORIGINAL REQUIREMENTS STATUS

| Requirement | Status |
|-------------|--------|
| Task type classification (bug/feature/idea) | ✅ Backend + Frontend |
| 2-level task nesting (subtasks) | ✅ Backend + Frontend |
| Flexible labeling system | ✅ Backend, ⚠️  No creation UI |
| Document upload support | ✅ Complete |
| User→Projects→Sections→Tasks→Subtasks | ✅ Complete |
| Photo/file upload for bugs | ✅ Enhanced (10+ types) |

---

## 💡 ADDITIONAL FEATURES TO CONSIDER

These are beyond the original scope but could be valuable:

1. **Task Comments/Activity Log** - Track changes and discussions
2. **Due Dates** - Add deadlines to tasks
3. **Priority Levels** - Low/Medium/High/Critical
4. **Task Dependencies** - Link related tasks
5. **Custom Fields** - Per-project metadata
6. **Bulk Operations** - Select multiple tasks to label/move
7. **Export/Import** - JSON/CSV export for reporting
8. **Webhooks** - Notify external systems on events
9. **Task Templates** - Pre-filled bug/feature templates
10. **Advanced Filters** - Saved filter views

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

**Labels don't appear in TaskModal:**
- Check if labels exist: `curl http://localhost:3300/api/users/1/labels`
- Create labels via API (see testing section)
- Verify `store.loadLabels()` is called on login

**Subtasks not showing:**
- Only appear when editing existing tasks
- Check backend logs for errors
- Verify parent task exists

**Docker container not starting:**
```bash
# Check logs
docker logs local-todo-app-backend

# Rebuild
docker-compose up -d --build local-todo-app-backend
```

**Database migrations not applied:**
- Delete volume and recreate: `docker volume rm todo-app-data`
- Restart backend container

### Debug Endpoints

```bash
# Health check
curl http://localhost:3300/api/health

# Check if token auth works
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3300/api/users/1/projects
```

---

**Document Version:** 1.0
**Last Updated:** November 6, 2025
**Author:** Claude Code Assistant
**Status:** 70% Complete - Ready for Testing & Phase 4
