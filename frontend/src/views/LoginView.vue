<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Project Tracker</h1>
      <p class="subtitle">{{ isRegistering ? 'Create your account' : 'Sign in to your account' }}</p>

      <div v-if="error" class="error-message">{{ error }}</div>

      <form @submit.prevent="handleSubmit">
        <input
          v-model="username"
          type="text"
          placeholder="username"
          class="login-input"
          autofocus
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="password"
          class="login-input"
          required
        />
        <button type="submit" class="login-button" :disabled="loading">
          {{ loading ? 'Please wait...' : (isRegistering ? 'Create Account' : 'Sign In') }}
        </button>
      </form>

      <div class="toggle-mode">
        <button @click="toggleMode" class="toggle-button">
          {{ isRegistering ? 'Already have an account? Sign in' : 'Need an account? Create one' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = useRouter()
const store = useAppStore()
const username = ref('')
const password = ref('')
const isRegistering = ref(false)
const error = ref('')
const loading = ref(false)

function toggleMode() {
  isRegistering.value = !isRegistering.value
  error.value = ''
}

async function handleSubmit() {
  error.value = ''

  if (!username.value.trim() || !password.value) {
    error.value = 'Please enter both username and password'
    return
  }

  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }

  loading.value = true

  try {
    if (isRegistering.value) {
      await store.register(username.value.trim(), password.value)
    } else {
      await store.login(username.value.trim(), password.value)
    }
    router.push('/projects')
  } catch (err) {
    error.value = err.message || 'An error occurred'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #ffeaa7 0%, #dfe6e9 100%);
}

.login-card {
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
  min-width: 400px;
}

h1 {
  color: #2d3436;
  margin-bottom: 0.5rem;
  font-size: 2rem;
}

.subtitle {
  color: #636e72;
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.login-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #dfe6e9;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 1rem;
  transition: border-color 0.2s;
}

.login-input:focus {
  outline: none;
  border-color: #a29bfe;
}

.login-button {
  width: 100%;
  padding: 0.875rem;
  background: #a29bfe;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.login-button:hover:not(:disabled) {
  background: #6c5ce7;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #ff7675;
  color: white;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.toggle-mode {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #dfe6e9;
}

.toggle-button {
  background: none;
  border: none;
  color: #a29bfe;
  cursor: pointer;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.toggle-button:hover {
  color: #6c5ce7;
  text-decoration: underline;
}
</style>
