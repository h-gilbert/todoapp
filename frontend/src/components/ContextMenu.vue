<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="context-menu"
      :style="{ top: `${adjustedPosition.y}px`, left: `${adjustedPosition.x}px` }"
      @click.stop
    >
      <div
        v-for="item in items"
        :key="item.label"
        class="context-menu-item"
        @click="handleItemClick(item)"
      >
        <span class="menu-icon">{{ item.icon }}</span>
        <span class="menu-label">{{ item.label }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  items: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'select'])

const menuRef = ref(null)
const adjustedPosition = ref({ x: 0, y: 0 })

function handleItemClick(item) {
  emit('select', item)
  emit('close')
}

function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    emit('close')
  }
}

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    // Wait for menu to be rendered
    await nextTick()

    // Adjust position to keep menu within viewport
    if (menuRef.value) {
      const menuRect = menuRef.value.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let x = props.position.x
      let y = props.position.y

      // Check if menu would overflow right edge
      if (x + menuRect.width > viewportWidth) {
        x = viewportWidth - menuRect.width - 10
      }

      // Check if menu would overflow bottom edge
      if (y + menuRect.height > viewportHeight) {
        // Position above the cursor instead
        y = y - menuRect.height
        // Make sure it doesn't go above the top
        if (y < 0) {
          y = 10
        }
      }

      adjustedPosition.value = { x, y }
    } else {
      adjustedPosition.value = props.position
    }

    // Add click listener when menu becomes visible
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  } else {
    // Remove click listener when menu is hidden
    document.removeEventListener('click', handleClickOutside)
  }
})

// Initialize position
watch(() => props.position, (newPos) => {
  adjustedPosition.value = newPos
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  padding: 0.5rem 0;
  z-index: 2000;
}

.context-menu-item {
  padding: 0.625rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
  color: #2d3436;
  font-size: 0.9rem;
}

.context-menu-item:hover {
  background: #f8f9fa;
}

.menu-icon {
  font-size: 1rem;
}

.menu-label {
  flex: 1;
}
</style>
