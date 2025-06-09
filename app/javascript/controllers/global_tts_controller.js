import { Controller } from "@hotwired/stimulus"

// Global TTS State Manager - directly manages button states across all controllers
window.GlobalTTSManager = {
  isActive: false,
  currentButtons: new Set(),
  
  // Register a button to be managed
  registerButton(button) {
    this.currentButtons.add(button)
    this.updateButtonState(button)
  },
  
  // Unregister button
  unregisterButton(button) {
    this.currentButtons.delete(button)
  },
  
  // Update all registered buttons
  updateAllButtons() {
    this.currentButtons.forEach(btn => this.updateButtonState(btn))
  },
  
  // Update specific button based on global state
  updateButtonState(button) {
    if (!button) return
    
    if (this.isActive) {
      // Show stop icon
      button.innerHTML = `
        <svg class="w-4 h-4" fill="#ef4444" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
        </svg>`
      button.dataset.speaking = "true"
      button.title = "Stop reading"
    } else {
      // Show speaker icon
      button.innerHTML = `
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 9v6h4l5 5V4L9 9H5z"></path>
          <path d="M15 9.5a3.5 3.5 0 010 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M17.5 7a6 6 0 010 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        </svg>`
      button.dataset.speaking = "false"
      button.title = "Read message aloud"
    }
  },
  
  // Set active state
  setActive(active) {
    this.isActive = active
    this.updateAllButtons()
  }
}

// Uses OpenAI TTS backend at /tts/speak
export default class extends Controller {
  connect() {
    console.log('Global TTS Controller connected')
    this.queue = []  // { text, key }
    this.spoken = new Set()
    this.playing = false
    this.processing = false
    this.prefetched = new Map()
    this.prefetchQueue = new Set() // Track what's being prefetched
    this.streamingActive = false // Track if streaming is happening

    this.enabled = JSON.parse(localStorage.getItem('ttsEnabled') ?? 'true')

    window.addEventListener('tts:toggle', () => this.toggle())
    window.addEventListener("tts:add", (e) => this.enqueue(e.detail))
    window.addEventListener("tts:stop", () => this.stop())
    window.addEventListener("beforeunload", () => {
      if (this.audio) this.audio.pause()
    })

    // Only watch for streaming content, don't prefetch existing content
    this.watchForStreamingContent()
  }

  watchForStreamingContent() {
    // Only watch for streaming content (new sentences being added)
    this.contentObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Only prefetch content that appears to be streaming (small chunks)
            if (node.textContent && node.textContent.trim().length > 0 && node.textContent.trim().length < 200) {
              // Check if this looks like a streaming sentence chunk
              const text = node.textContent.trim()
              if (text.match(/[.!?]$/)) {
                console.log('Detected streaming sentence, prefetching:', text.substring(0, 50) + '...')
                this.prefetchText(text)
              }
            }
          }
        })
      })
    })
    
    // Only observe containers that typically hold streaming content
    const streamingContainers = document.querySelectorAll('[id*="chunks"], [class*="chunks"]')
    streamingContainers.forEach(container => {
      this.contentObserver.observe(container, { 
        childList: true, 
        subtree: true 
      })
    })
  }

  async prefetchText(text) {
    const key = this.fp(text)
    if (this.prefetched.has(key) || this.prefetchQueue.has(key)) return
    
    this.prefetchQueue.add(key)
    try {
      console.log('Prefetching:', text.substring(0, 50) + '...')
      const blob = await this.fetchBlob(text, key)
      this.prefetched.set(key, blob)
      console.log('Prefetched successfully')
    } catch (e) {
      console.error('Prefetch failed:', e)
    } finally {
      this.prefetchQueue.delete(key)
    }
  }

  enqueue(text) {
    console.log('Enqueuing text:', text)
    if (!this.enabled) return
    
    const key = this.fp(text)
    if (this.spoken.has(key) || this.queue.some(i => i.key === key)) {
      console.log('Text already spoken or in queue, skipping')
      return
    }
    
    // Only prefetch when user actually initiates TTS
    this.prefetchText(text)
    
    this.queue.push({ text, key })
    console.log('Queue length:', this.queue.length)
    
    if (!this.processing) {
      console.log('Starting TTS processing')
      this.processing = true
      window.GlobalTTSManager.setActive(true)
    }
    this.playNext()
  }

  async playNext() {
    if (this.playing) {
      console.log('Already playing, waiting...')
      return
    }
    
    if (this.queue.length === 0) {
      if (this.processing) {
        console.log('Queue empty, ending TTS session')
        this.processing = false
        window.GlobalTTSManager.setActive(false)
      }
      return
    }
    
    const { text, key } = this.queue.shift()
    console.log('Playing next sentence:', text)
    
    try {
      this.playing = true
      await this.playAudio(text, key)
      this.spoken.add(key)
      console.log('Sentence completed')
    } catch (e) {
      console.error('Error playing audio:', e)
    } finally {
      this.playing = false
      // Immediately continue to next without gap
      setTimeout(() => this.playNext(), 10)
    }
  }

  async playAudio(text, key) {
    console.log('Loading audio for:', text)
    
    // Use prefetched audio if available, otherwise fetch
    let blob
    if (this.prefetched.has(key)) {
      console.log('Using prefetched audio')
      blob = this.prefetched.get(key)
    } else {
      console.log('Fetching TTS from server (not prefetched)')
      blob = await this.fetchBlob(text, key)
    }
    
    const url = URL.createObjectURL(blob)
    this.audio = new Audio(url)
    
    return new Promise((resolve) => {
      const done = () => {
        URL.revokeObjectURL(url)
        resolve()
      }
      this.audio.onended = done
      this.audio.onerror = done
      this.audio.play().then(() => {
        console.log('Audio started playing')
      }).catch(e => {
        console.error('Audio play failed:', e)
        done()
      })
    })
  }

  async fetchBlob(text, key) {
    console.log('Fetching TTS from server')
    const csrf = document.querySelector('meta[name="csrf-token"]').content
    const res = await fetch('/tts/speak', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
      body: JSON.stringify({text})
    })
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`)
    const blob = await res.blob()
    return blob
  }

  fp(str) {
    return str.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim()
  }

  stop() {
    console.log('Stopping TTS')
    if (this.audio) {
      this.audio.pause()
      this.audio = null
    }
    this.playing = false
    this.processing = false
    this.queue = []
    window.GlobalTTSManager.setActive(false)
  }

  toggle() {
    this.enabled = !this.enabled
    console.log('TTS enabled:', this.enabled)
    localStorage.setItem('ttsEnabled', JSON.stringify(this.enabled))
    if (!this.enabled) {
      this.stop()
    }
  }
  
  disconnect() {
    if (this.contentObserver) {
      this.contentObserver.disconnect()
    }
  }
} 