<template>
  <div id="app">
    <!-- Mobile placeholder message -->
    <div class="mobile-overlay">
      <div class="mobile-message">
        <div class="mobile-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </div>
        <h1>Desktop Only</h1>
        <p>This application is designed for desktop use only. Please open it on a computer with a larger screen for the best experience.</p>
      </div>
    </div>

    <!-- Main app content (hidden on mobile) -->
    <div class="desktop-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #fafafa;
}

#app {
  min-height: 100vh;
}

/* Mobile overlay - shown on mobile, hidden on desktop */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 9999;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.mobile-message {
  text-align: center;
  color: white;
  max-width: 320px;
}

.mobile-icon {
  margin-bottom: 24px;
  opacity: 0.9;
}

.mobile-icon svg {
  color: white;
}

.mobile-message h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 16px;
}

.mobile-message p {
  font-size: 16px;
  line-height: 1.6;
  opacity: 0.9;
}

/* Desktop content - shown on desktop, hidden on mobile */
.desktop-content {
  display: block;
}

/* Show mobile overlay and hide desktop content on small screens */
@media (max-width: 768px) {
  .mobile-overlay {
    display: flex;
  }

  .desktop-content {
    display: none;
  }
}
</style>
