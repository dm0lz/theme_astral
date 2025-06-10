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
    console.log('🎯 Global TTS Controller: Connecting...')
    
    // Prevent multiple global controllers
    if (window.GlobalTTSInstance) {
      console.warn('⚠️  Global TTS Controller already exists! Disconnecting previous instance.')
      window.GlobalTTSInstance.cleanup()
    }
    
    window.GlobalTTSInstance = this
    
    this.initializeState()
    this.setupEventListeners()
    
    // Debug: Check if there are multiple global controllers
    if (window.GlobalTTSControllerCount) {
      window.GlobalTTSControllerCount++
      console.warn(`⚠️  Multiple Global TTS Controllers detected! Count: ${window.GlobalTTSControllerCount}`)
    } else {
      window.GlobalTTSControllerCount = 1
      console.log('✅ First Global TTS Controller initialized')
    }
  }

  disconnect() {
    console.log('🎯 Global TTS Controller: Disconnecting...')
    this.cleanup()
    if (window.GlobalTTSControllerCount) {
      window.GlobalTTSControllerCount--
    }
    
    // Clear global instance reference
    if (window.GlobalTTSInstance === this) {
      window.GlobalTTSInstance = null
    }
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
    
    // Enhanced duplicate prevention
    this.recentTexts = new Map() // Track recent texts with timestamps
    this.cooldownPeriod = 2000 // 2 seconds cooldown for identical text
    this.veryRecentTexts = new Map() // Track very recent texts (last 500ms)
    this.rapidCooldown = 500 // 500ms for rapid duplicate prevention
    
    // Audio-level deduplication
    this.currentlyPlayingKey = null
  }

  setupEventListeners() {
    // Remove any existing listeners first to prevent duplicates
    if (window.TTSEventListenersAdded) {
      console.warn('⚠️ TTS Event listeners already exist, removing old ones')
      window.removeEventListener('tts:toggle', window.TTSToggleHandler)
      window.removeEventListener('tts:add', window.TTSAddHandler) 
      window.removeEventListener('tts:stop', window.TTSStopHandler)
      window.removeEventListener('beforeunload', window.TTSBeforeUnloadHandler)
      window.removeEventListener('tts:enabled', window.TTSEnabledHandler)
    }
    
    // Create handler functions and store them globally to prevent duplicates
    window.TTSToggleHandler = () => this.toggle()
    window.TTSAddHandler = (e) => {
      console.log(`📥 TTS Event Received:`, {
        text: e.detail.text?.substring(0, 100) + '...',
        messageId: e.detail.messageId,
        timestamp: new Date().toISOString(),
        listenerCount: window.TTSEventListenerCount || 'unknown'
      })
      this.enqueue(e.detail.text, e.detail.messageId)
    }
    window.TTSStopHandler = () => this.stop()
    window.TTSBeforeUnloadHandler = () => this.cleanup()
    window.TTSEnabledHandler = (e) => {
      window.__ttsEnabled = e.detail
      window.GlobalTTSManager.updateAllButtons()
    }
    
    // Add event listeners
    window.addEventListener('tts:toggle', window.TTSToggleHandler)
    window.addEventListener('tts:add', window.TTSAddHandler)
    window.addEventListener('tts:stop', window.TTSStopHandler)
    window.addEventListener('beforeunload', window.TTSBeforeUnloadHandler)
    window.addEventListener('tts:enabled', window.TTSEnabledHandler)
    
    // Mark that event listeners have been added
    window.TTSEventListenersAdded = true
    window.TTSEventListenerCount = (window.TTSEventListenerCount || 0) + 1
    console.log(`✅ TTS Event listeners added (count: ${window.TTSEventListenerCount})`)
  }

  // ===== CONTENT DETECTION =====
  // Removed redundant streaming observer and content handling methods
  // Individual TTS controllers handle their own streaming content

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
    if (!this.enabled || !text) {
      console.log('🚫 TTS: Enqueue blocked - disabled or no text')
      return
    }
    
    const key = this.normalizeText(text)
    console.log(`🔄 TTS Enqueue:`, {
      originalText: text.substring(0, 50) + '...',
      normalizedKey: key,
      messageId: messageId,
      queueLength: this.queue.length,
      processing: this.processing
    })
    
    if (this.isAlreadyProcessed(key)) {
      console.log(`❌ TTS: Already processed - ${key}`)
      return
    }
    
    // Enhanced duplicate prevention with cooldown
    if (this.isRecentDuplicate(key)) {
      console.log(`❌ TTS: Recent duplicate - ${key}`)
      return
    }
    
    // Rapid duplicate prevention (for texts arriving within 500ms)
    if (this.isVeryRecentDuplicate(key)) {
      console.log(`❌ TTS: Very recent duplicate - ${key}`)
      return
    }
    
    console.log(`✅ TTS: Adding to queue - ${key}`)
    this.markAsRecent(key)
    this.markAsVeryRecent(key)
    this.prefetchText(text)
    this.queue.push({ text, key })
    
    if (!this.processing) {
      console.log(`🚀 TTS: Starting processing for ${messageId}`)
      this.startProcessing(messageId)
    }
    
    this.processQueue()
  }

  isAlreadyProcessed(key) {
    return this.spoken.has(key) || this.queue.some(item => item.key === key)
  }
  
  isRecentDuplicate(key) {
    if (!this.recentTexts.has(key)) return false
    
    const lastTimestamp = this.recentTexts.get(key)
    const now = Date.now()
    
    return (now - lastTimestamp) < this.cooldownPeriod
  }
  
  isVeryRecentDuplicate(key) {
    if (!this.veryRecentTexts.has(key)) return false
    
    const lastTimestamp = this.veryRecentTexts.get(key)
    const now = Date.now()
    
    return (now - lastTimestamp) < this.rapidCooldown
  }
  
  markAsRecent(key) {
    const now = Date.now()
    this.recentTexts.set(key, now)
    
    // Clean up old entries to prevent memory leaks
    for (const [textKey, timestamp] of this.recentTexts.entries()) {
      if (now - timestamp > this.cooldownPeriod * 2) {
        this.recentTexts.delete(textKey)
      }
    }
  }
  
  markAsVeryRecent(key) {
    const now = Date.now()
    this.veryRecentTexts.set(key, now)
    
    // Clean up old entries to prevent memory leaks
    for (const [textKey, timestamp] of this.veryRecentTexts.entries()) {
      if (now - timestamp > this.rapidCooldown * 2) {
        this.veryRecentTexts.delete(textKey)
      }
    }
  }

  startProcessing(messageId) {
    // Safety check: if already processing, stop the current session first
    if (this.processing && this.currentMessageId !== messageId) {
      this.stop()
    }
    
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
    // Final deduplication check - prevent the same audio from playing simultaneously
    if (this.currentlyPlayingKey === key) {
      console.log(`🚫 TTS: Audio already playing for key: ${key}`)
      return
    }
    
    // Check if any audio is currently playing the same content
    if (window.CurrentlyPlayingTTSKey === key) {
      console.log(`🚫 TTS: Audio globally playing for key: ${key}`)
      return
    }
    
    // Mark this audio as currently playing
    this.currentlyPlayingKey = key
    window.CurrentlyPlayingTTSKey = key
    
    try {
      const blob = await this.getAudioBlob(text, key)
      const audio = this.createAudioElement(blob)
      
      return new Promise((resolve) => {
        const cleanup = () => {
          URL.revokeObjectURL(audio.src)
          // Clear the currently playing markers
          this.currentlyPlayingKey = null
          window.CurrentlyPlayingTTSKey = null
          resolve()
        }
        
        audio.onended = cleanup
        audio.onerror = cleanup
        audio.play().then(()=>{
          const btn=window.GlobalTTSManager.getButtonByMessageId(this.currentMessageId);
          if(btn) window.GlobalTTSManager.setStopState(btn);
        }).catch(cleanup)
      })
    } catch (error) {
      // Clear markers on error
      this.currentlyPlayingKey = null
      window.CurrentlyPlayingTTSKey = null
      throw error
    }
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
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[.!?]+$/, '') // Remove trailing punctuation
      .replace(/[^\w\s]/g, '') // Remove all non-word characters except spaces
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
    
    // Clear currently playing markers
    this.currentlyPlayingKey = null
    window.CurrentlyPlayingTTSKey = null
    
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
    
    // Clean up event listeners
    if (window.TTSEventListenersAdded) {
      console.log('🧹 Cleaning up TTS event listeners')
      window.removeEventListener('tts:toggle', window.TTSToggleHandler)
      window.removeEventListener('tts:add', window.TTSAddHandler)
      window.removeEventListener('tts:stop', window.TTSStopHandler)
      window.removeEventListener('beforeunload', window.TTSBeforeUnloadHandler)
      window.removeEventListener('tts:enabled', window.TTSEnabledHandler)
      
      // Clear the global references
      window.TTSEventListenersAdded = false
      window.TTSEventListenerCount = Math.max(0, (window.TTSEventListenerCount || 1) - 1)
    }
  }
} 