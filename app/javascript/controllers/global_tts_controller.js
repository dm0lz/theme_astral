import { Controller } from "@hotwired/stimulus"

/**
 * Global TTS State Manager
 * Tracks active TTS state by message ID to survive DOM replacements
 */
window.GlobalTTSManager = {
  isActive: false,
  activeMessageId: null, // Track the message ID instead of button element
  allButtons: new Map(), // Map button -> message ID for cleanup
  
  registerButton(button, messageId = null) {
    // Extract message ID from button if not provided
    if (!messageId) {
      messageId = this.extractMessageId(button)
    }
    
    this.allButtons.set(button, messageId)

    // If active message element disappeared, adopt this new one if ids differ
    if (this.isActive && this.activeMessageId && !document.getElementById(this.activeMessageId)) {
      // Update to new messageId (likely replacement of temp message)
      this.activeMessageId = messageId
    }
    
    // Determine enabled flag lazily
    let enabled
    if (window.__ttsEnabled === undefined) {
      enabled = JSON.parse(localStorage.getItem('ttsEnabled') ?? 'true')
      window.__ttsEnabled = enabled
    } else {
      enabled = window.__ttsEnabled
    }
    button.classList.toggle('hidden', !enabled);
    if (enabled && this.isActive && messageId === this.activeMessageId) {
      this.setStopState(button)
    } else {
      if (enabled) this.setSpeakerState(button)
    }
  },
  
  unregisterButton(button) {
    this.allButtons.delete(button)
  },
  
  extractMessageId(button) {
    // Try to find message ID from various sources
    let messageId = button.dataset.ttsMessageId
    
    if (!messageId) {
      // Look for closest message container with an ID
      const messageContainer = button.closest('[id*="chat_message"], [id*="temp_message"]')
      if (messageContainer) {
        messageId = messageContainer.id
      }
    }
    
    if (!messageId) {
      // Extract from data-tts-text-value or create from text content
      const text = button.dataset.ttsTextValue
      if (text) {
        messageId = 'tts_' + this.hashString(text)
      }
    }
    
    return messageId
  },
  
  hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString()
  },
  
  setActiveMessage(messageId) {
    this.activeMessageId = messageId
    this.isActive = true
    
    // set loading spinner on active button
    const btn = this.getButtonByMessageId(messageId)
    if (btn) this.showLoading(btn)
    
    // reset others
    this.allButtons.forEach((msg, button) => {
      if (msg !== messageId) this.setSpeakerState(button)
    })
  },
  
  clearActiveMessage() {
    this.activeMessageId = null
    this.isActive = false
    
    // Reset all buttons to speaker state
    this.updateAllButtons()
  },
  
  updateAllButtons() {
    this.allButtons.forEach((messageId, button) => {
      // visibility
      button.classList.toggle('hidden', !window.__ttsEnabled);

      if (!window.__ttsEnabled) return;
      if (this.isActive && messageId === this.activeMessageId) {
        this.setStopState(button)
      } else {
        this.setSpeakerState(button)
      }
    })
  },
  
  setStopState(button) {
    button.disabled = false;
    button.innerHTML = `
      <svg class="w-4 h-4" fill="#ef4444" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
      </svg>`
    button.dataset.speaking = "true"
    button.title = "Stop reading"
  },
  
  setSpeakerState(button) {
    button.disabled = false;
    button.innerHTML = `
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5 9v6h4l5 5V4L9 9H5z"></path>
        <path d="M15 9.5a3.5 3.5 0 010 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M17.5 7a6 6 0 010 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>`
    button.dataset.speaking = "false"
    button.title = "Read message aloud"
  },
  
  getButtonByMessageId(id) {
    for (const [btn, msg] of this.allButtons.entries()) {
      if (msg === id) return btn
    }
    return null
  },
  
  showLoading(button) {
    button.disabled = true;
    button.innerHTML = `
      <svg class="w-4 h-4 animate-spin" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4"></circle>
        <path class="opacity-75" d="M4 12a8 8 0 018-8" stroke-width="4" stroke-linecap="round"></path>
      </svg>`
    button.dataset.speaking = "loading"
    button.title = "Loading audio"
  }
}

/**
 * Global TTS Controller
 * Manages speech synthesis queue and audio playback using OpenAI TTS API
 */
export default class extends Controller {
  connect() {
    this.initializeState()
    this.setupEventListeners()
    this.initializeStreamingObserver()
  }

  disconnect() {
    this.cleanup()
  }

  // ===== INITIALIZATION =====

  initializeState() {
    this.queue = []
    this.spoken = new Set()
    this.playing = false
    this.processing = false
    this.prefetched = new Map()
    this.prefetchQueue = new Set()
    this.currentMessageId = null // Track which message initiated current session
    this.enabled = JSON.parse(localStorage.getItem('ttsEnabled') ?? 'true')
    window.__ttsEnabled = this.enabled
  }

  setupEventListeners() {
    window.addEventListener('tts:toggle', () => this.toggle())
    window.addEventListener('tts:add', (e) => this.enqueue(e.detail.text, e.detail.messageId))
    window.addEventListener('tts:stop', () => this.stop())
    window.addEventListener('beforeunload', () => this.cleanup())
    window.addEventListener('tts:enabled',e=>{window.__ttsEnabled=e.detail;window.GlobalTTSManager.updateAllButtons();});
  }

  initializeStreamingObserver() {
    this.contentObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          this.handleNewStreamingContent(node)
        })
      })
    })
    
    const streamingContainers = document.querySelectorAll('[id*="chunks"], [class*="chunks"]')
    streamingContainers.forEach(container => {
      this.contentObserver.observe(container, { 
        childList: true, 
        subtree: true 
      })
    })
  }

  // ===== CONTENT DETECTION =====

  handleNewStreamingContent(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    
    const text = node.textContent?.trim()
    if (!text || text.length === 0 || text.length >= 200) return
    
    // Only prefetch complete sentences from streaming
    if (text.match(/[.!?]$/)) {
      this.prefetchText(text)
    }
  }

  // ===== PREFETCHING =====

  async prefetchText(text) {
    const key = this.normalizeText(text)
    if (this.prefetched.has(key) || this.prefetchQueue.has(key)) return
    
    this.prefetchQueue.add(key)
    try {
      const blob = await this.fetchAudioBlob(text)
      this.prefetched.set(key, blob)
    } catch (error) {
      console.error('TTS prefetch failed:', error.message)
    } finally {
      this.prefetchQueue.delete(key)
    }
  }

  // ===== QUEUE MANAGEMENT =====

  enqueue(text, messageId = null) {
    if (!this.enabled || !text) return
    
    const key = this.normalizeText(text)
    if (this.isAlreadyProcessed(key)) return
    
    this.prefetchText(text)
    this.queue.push({ text, key })
    
    if (!this.processing) {
      this.startProcessing(messageId)
    }
    
    this.processQueue()
  }

  isAlreadyProcessed(key) {
    return this.spoken.has(key) || this.queue.some(item => item.key === key)
  }

  startProcessing(messageId) {
    this.processing = true
    this.currentMessageId = messageId
    window.GlobalTTSManager.setActiveMessage(messageId)

    // iOS autoplay workaround: start a silent audio right away within user gesture
    try {
      if (!this.audio) {
        const silentSrc = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
        this.audio = new Audio(silentSrc)
        this.audio.play().catch(()=>{})
      }
    } catch(e){}
  }

  async processQueue() {
    if (this.playing || this.queue.length === 0) {
      if (this.queue.length === 0 && this.processing) {
        this.endProcessing()
      }
      return
    }
    
    const { text, key } = this.queue.shift()
    
    try {
      this.playing = true
      await this.playAudio(text, key)
      this.spoken.add(key)
    } catch (error) {
      console.error('TTS playback error:', error.message)
    } finally {
      this.playing = false
      // Continue with minimal delay
      setTimeout(() => this.processQueue(), 10)
    }
  }

  endProcessing() {
    this.processing = false
    this.currentMessageId = null
    window.GlobalTTSManager.clearActiveMessage()
  }

  // ===== AUDIO PLAYBACK =====

  async playAudio(text, key) {
    const blob = await this.getAudioBlob(text, key)
    const audio = this.createAudioElement(blob)
    
    return new Promise((resolve) => {
      const cleanup = () => {
        URL.revokeObjectURL(audio.src)
        resolve()
      }
      
      audio.onended = cleanup
      audio.onerror = cleanup
      audio.play().then(()=>{
        const btn=window.GlobalTTSManager.getButtonByMessageId(this.currentMessageId);
        if(btn) window.GlobalTTSManager.setStopState(btn);
      }).catch(cleanup)
    })
  }

  async getAudioBlob(text, key) {
    if (this.prefetched.has(key)) {
      return this.prefetched.get(key)
    }
    return await this.fetchAudioBlob(text)
  }

  createAudioElement(blob) {
    const url = URL.createObjectURL(blob)
    if (!this.audio) {
      this.audio = new Audio()
    } else {
      this.audio.pause()
    }
    this.audio.src = url
    return this.audio
  }

  // ===== API COMMUNICATION =====

  async fetchAudioBlob(text) {
    const response = await fetch('/tts/speak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCSRFToken()
      },
      body: JSON.stringify({ text })
    })
    
    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`)
    }
    
    return await response.blob()
  }

  getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ''
  }

  // ===== UTILITIES =====

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.!?]+$/, '')
      .trim()
  }

  // ===== CONTROLS =====

  stop() {
    if (this.audio) {
      this.audio.pause()
      this.audio = null
    }
    
    this.playing = false
    this.processing = false
    this.queue = []
    this.currentMessageId = null
    window.GlobalTTSManager.clearActiveMessage()
  }

  toggle() {
    this.enabled = !this.enabled
    localStorage.setItem('ttsEnabled', JSON.stringify(this.enabled))
    window.dispatchEvent(new CustomEvent('tts:enabled',{detail:this.enabled}))
    
    if (!this.enabled) {
      this.stop()
    }
  }

  cleanup() {
    if (this.audio) {
      this.audio.pause()
    }
    
    if (this.contentObserver) {
      this.contentObserver.disconnect()
    }
  }
} 