<template>
  <div class="user-dropdown" ref="dropdownRef">
    <button @click="toggleDropdown" class="user-button">
      <div class="user-avatar">{{ userInitial }}</div>
      <span class="username">{{ store.user?.username }}</span>
      <svg class="dropdown-icon" :class="{ open: isOpen }" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu">
        <div class="dropdown-header">
          <div class="user-email">Signed in as</div>
          <div class="user-name">{{ store.user?.username }}</div>
        </div>
        <div class="dropdown-divider"></div>
        <button @click="handleChangePassword" class="dropdown-item">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 7.5H3.5C2.67157 7.5 2 8.17157 2 9V13C2 13.8284 2.67157 14.5 3.5 14.5H12.5C13.3284 14.5 14 13.8284 14 13V9C14 8.17157 13.3284 7.5 12.5 7.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 7.5V4.5C5 3.70435 5.31607 2.94129 5.87868 2.37868C6.44129 1.81607 7.20435 1.5 8 1.5C8.79565 1.5 9.55871 1.81607 10.1213 2.37868C10.6839 2.94129 11 3.70435 11 4.5V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Change Password
        </button>
        <button @click="handleLogout" class="dropdown-item logout">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 14H3C2.73478 14 2.48043 13.8946 2.29289 13.7071C2.10536 13.5196 2 13.2652 2 13V3C2 2.73478 2.10536 2.48043 2.29289 2.29289C2.48043 2.10536 2.73478 2 3 2H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 11L14 8L11 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Logout
        </button>
      </div>
    </transition>

    <Teleport to="body">
      <ChangePasswordModal
        :show="showChangePasswordModal"
        @close="showChangePasswordModal = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import ChangePasswordModal from './ChangePasswordModal.vue'

const router = useRouter()
const store = useAppStore()
const isOpen = ref(false)
const dropdownRef = ref(null)
const showChangePasswordModal = ref(false)

const userInitial = computed(() => {
  return store.user?.username?.charAt(0).toUpperCase() || 'U'
})

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function handleChangePassword() {
  isOpen.value = false
  showChangePasswordModal.value = true
}

async function handleLogout() {
  isOpen.value = false
  await store.logout()
  router.push('/')
}

function handleClickOutside(event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.user-dropdown {
  position: relative;
}

.user-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
}

.user-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.username {
  font-weight: 600;
  color: #2d3436;
  font-size: 0.95rem;
  flex: 1;
  text-align: left;
}

.dropdown-icon {
  color: #636e72;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.dropdown-icon.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 0.5rem;
  z-index: 1000;
  min-width: 200px;
}

.dropdown-header {
  padding: 0.75rem;
}

.user-email {
  font-size: 0.75rem;
  color: #636e72;
  margin-bottom: 0.25rem;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2d3436;
}

.dropdown-divider {
  height: 1px;
  background: #e1e4e8;
  margin: 0.5rem 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: #2d3436;
  transition: background 0.2s;
  text-align: left;
}

.dropdown-item:hover {
  background: #f8f9fa;
}

.dropdown-item.logout {
  color: #d63031;
}

.dropdown-item.logout:hover {
  background: #fff5f5;
}

.dropdown-item svg {
  width: 16px;
  height: 16px;
}

/* Transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
