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
    
    // Force visibility update for iOS compatibility
    if (enabled) {
      button.classList.remove('hidden')
      button.style.display = '' // Clear any inline display:none
    } else {
      button.classList.add('hidden')
    }
    
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
      // Force visibility update for iOS compatibility
      if (window.__ttsEnabled) {
        button.classList.remove('hidden')
        button.style.display = '' // Clear any inline display:none
      } else {
        button.classList.add('hidden')
        return
      }
      
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
    
    // Ensure visibility on iOS
    button.style.opacity = '1'
    button.style.visibility = 'visible'
    button.style.display = button.style.display || 'inline-flex'
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
    
    // Ensure visibility on iOS
    button.style.opacity = '1'
    button.style.visibility = 'visible'
    button.style.display = button.style.display || 'inline-flex'
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
    // Prevent multiple global controllers
    if (window.GlobalTTSInstance) {
      window.GlobalTTSInstance.cleanup()
    }
    
    window.GlobalTTSInstance = this
    
    this.initializeState()
    this.setupEventListeners()
    this.setupIOSAudioUnlock()
    
    // iOS compatibility: ensure all existing TTS buttons are visible
    setTimeout(() => {
      this.ensureAllButtonsVisible()
    }, 100)
    
    // Show iOS prompt proactively if on iOS and TTS is enabled
    if (this.isIOS() && this.enabled && !window.__audioUnlocked) {
      setTimeout(() => {
        this.showIOSPrompt()
      }, 500) // Small delay to ensure page is loaded
    }
    
    // Debug: Check if there are multiple global controllers
    if (window.GlobalTTSControllerCount) {
      window.GlobalTTSControllerCount++
    } else {
      window.GlobalTTSControllerCount = 1
    }
  }

  disconnect() {
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
      window.removeEventListener('tts:toggle', window.TTSToggleHandler)
      window.removeEventListener('tts:add', window.TTSAddHandler) 
      window.removeEventListener('tts:stop', window.TTSStopHandler)
      window.removeEventListener('beforeunload', window.TTSBeforeUnloadHandler)
      window.removeEventListener('tts:enabled', window.TTSEnabledHandler)
    }
    
    // Create handler functions and store them globally to prevent duplicates
    window.TTSToggleHandler = () => this.toggle()
    window.TTSAddHandler = (e) => this.enqueue(e.detail.text, e.detail.messageId)
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
      return
    }
    
    // Check iOS audio unlock status
    if (this.isIOS() && !window.__audioUnlocked) {
      // Show prompt and queue the text for later
      this.showIOSPrompt()
      this.pendingIOSTexts = this.pendingIOSTexts || []
      this.pendingIOSTexts.push({ text, messageId })
      return
    }
    
    const key = this.normalizeText(text)
    
    if (this.isAlreadyProcessed(key)) {
      return
    }
    
    // Enhanced duplicate prevention with cooldown
    if (this.isRecentDuplicate(key)) {
      return
    }
    
    // Rapid duplicate prevention (for texts arriving within 500ms)
    if (this.isVeryRecentDuplicate(key)) {
      return
    }
    
    this.markAsRecent(key)
    this.markAsVeryRecent(key)
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

    // iOS-specific audio initialization
    if (this.isIOS() && !this.audio) {
      try {
        // Create a properly configured audio element for iOS
        this.audio = new Audio()
        this.audio.preload = 'auto'
        this.audio.playsInline = true
        this.audio.controls = false
        this.audio.muted = false
        this.audio.volume = 1.0
        this.audio.setAttribute('playsinline', 'true')
        this.audio.setAttribute('webkit-playsinline', 'true')
        
        // Set a silent audio source to prepare the element
        const silentSrc = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
        this.audio.src = silentSrc
        
        // Attempt to load and play silently to prepare for real audio
        this.audio.load()
        this.audio.play().catch(() => {
          // If silent play fails, we'll handle it during actual playback
        })
      } catch(e) {
        // Fallback - will create audio elements as needed
      }
    }
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
      return
    }
    
    // Check if any audio is currently playing the same content
    if (window.CurrentlyPlayingTTSKey === key) {
      return
    }
    
    // Mark this audio as currently playing
    this.currentlyPlayingKey = key
    window.CurrentlyPlayingTTSKey = key
    
    try {
      const blob = await this.getAudioBlob(text, key)
      const audio = this.createAudioElement(blob)
      
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          URL.revokeObjectURL(audio.src)
          // Clear the currently playing markers
          this.currentlyPlayingKey = null
          window.CurrentlyPlayingTTSKey = null
          resolve()
        }
        
        const handleError = (error) => {
          URL.revokeObjectURL(audio.src)
          this.currentlyPlayingKey = null
          window.CurrentlyPlayingTTSKey = null
          reject(error)
        }
        
        // Set up event handlers
        audio.onended = cleanup
        audio.onerror = (e) => handleError(new Error('Audio playback failed'))
        audio.oncanplay = () => {
          // iOS-specific: ensure we can play before attempting
          if (this.isIOS() && audio.readyState < 3) {
            return // Wait for more data
          }
        }
        
        // Attempt to play with iOS-specific handling
        const playPromise = audio.play()
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            const btn = window.GlobalTTSManager.getButtonByMessageId(this.currentMessageId)
            if (btn) window.GlobalTTSManager.setStopState(btn)
          }).catch((error) => {
            // iOS playback failed - try to re-unlock audio
            if (this.isIOS()) {
              this.unlockIOSAudio().then(() => {
                // Retry playback once
                const retryPromise = audio.play()
                if (retryPromise) {
                  retryPromise.then(() => {
                    const btn = window.GlobalTTSManager.getButtonByMessageId(this.currentMessageId)
                    if (btn) window.GlobalTTSManager.setStopState(btn)
                  }).catch(handleError)
                }
              }).catch(handleError)
            } else {
              handleError(error)
            }
          })
        } else {
          // Older browsers - no promise returned
          const btn = window.GlobalTTSManager.getButtonByMessageId(this.currentMessageId)
          if (btn) window.GlobalTTSManager.setStopState(btn)
        }
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
    
    // Create fresh audio element for iOS compatibility
    const audio = new Audio()
    
    // iOS-specific audio configuration
    if (this.isIOS()) {
      audio.preload = 'auto'
      audio.playsInline = true
      audio.controls = false
      audio.autoplay = false
      audio.muted = false
      audio.volume = 1.0
      
      // Set important attributes for iOS
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('webkit-playsinline', 'true')
    }
    
    audio.src = url
    
    // Store reference but don't reuse on iOS
    if (!this.isIOS()) {
      if (this.audio) {
        this.audio.pause()
      }
      this.audio = audio
    }
    
    return audio
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
    
    // Clean up iOS prompt
    this.hideIOSPrompt()
    
    // Clear pending iOS texts
    this.pendingIOSTexts = []
    
    // Clean up event listeners
    if (window.TTSEventListenersAdded) {
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

  // ===== iOS AUDIO UNLOCK SYSTEM =====

  setupIOSAudioUnlock() {
    if (!this.isIOS()) return
    
    // Add early unlock listeners for common user interactions
    const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown', 'mousedown']
    
    this.earlyUnlockHandler = async () => {
      if (!window.__audioUnlocked) {
        await this.unlockIOSAudio()
      }
    }
    
    // Add listeners to document to catch any user interaction
    unlockEvents.forEach(event => {
      document.addEventListener(event, this.earlyUnlockHandler, { 
        once: true, 
        passive: true,
        capture: true 
      })
    })
  }

  async unlockIOSAudio() {
    if (window.__audioUnlocked) return true
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Unlock timeout')), 5000) // 5 second timeout
    })
    
    const unlockPromise = this.performIOSUnlock()
    
    try {
      await Promise.race([unlockPromise, timeoutPromise])
      return true
    } catch (error) {
      return false
    }
  }
  
  async performIOSUnlock() {
    try {
      // Strategy 1: AudioContext unlock
      const AudioContext = window.AudioContext || window.webkitAudioContext
      let audioContextUnlocked = false
      
      if (AudioContext) {
        try {
          if (!this.audioContext) {
            this.audioContext = new AudioContext()
          }
          
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume()
          }
          
          if (this.audioContext.state === 'running') {
            audioContextUnlocked = true
          }
        } catch (contextError) {
          // AudioContext failed, continue with HTML5 audio
        }
      }
      
      // Strategy 2: HTML5 Audio unlock with timeout for each attempt
      let htmlAudioUnlocked = false
      
      const createTimeLimitedPromise = (promiseFunc, timeLimit = 2000) => {
        return Promise.race([
          promiseFunc(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Attempt timeout')), timeLimit))
        ])
      }
      
      const unlockAttempts = [
        // Attempt 1: Simple WAV
        () => {
          const audio = new Audio()
          audio.volume = 0.1
          audio.muted = false
          audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IAAAAAEAAQARKwAAIlYAAAIAEABkYXRhAgAAAAEA'
          return audio.play()
        },
        // Attempt 2: Different WAV format
        () => {
          const audio = new Audio()
          audio.volume = 0.1
          audio.muted = false
          audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
          return audio.play()
        },
        // Attempt 3: Oscillator if AudioContext is available
        () => {
          if (this.audioContext && this.audioContext.state === 'running') {
            const oscillator = this.audioContext.createOscillator()
            const gainNode = this.audioContext.createGain()
            oscillator.connect(gainNode)
            gainNode.connect(this.audioContext.destination)
            oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime)
            gainNode.gain.setValueAtTime(0.01, this.audioContext.currentTime)
            oscillator.start(this.audioContext.currentTime)
            oscillator.stop(this.audioContext.currentTime + 0.05)
            return Promise.resolve()
          }
          return Promise.reject('No AudioContext available')
        }
      ]
      
      // Try each unlock method with individual timeouts
      for (let i = 0; i < unlockAttempts.length; i++) {
        try {
          await createTimeLimitedPromise(unlockAttempts[i], 1500)
          htmlAudioUnlocked = true
          break
        } catch (error) {
          // Continue to next attempt
          continue
        }
      }
      
      // Check if any method succeeded
      if (audioContextUnlocked || htmlAudioUnlocked) {
        // Small delay to ensure unlock takes effect
        await new Promise(resolve => setTimeout(resolve, 100))
        
        window.__audioUnlocked = true
        
        // Remove the iOS prompt
        this.hideIOSPrompt()
        
        // Process any pending iOS texts
        if (this.pendingIOSTexts && this.pendingIOSTexts.length > 0) {
          const pendingTexts = this.pendingIOSTexts
          this.pendingIOSTexts = []
          
          // Process each pending text
          pendingTexts.forEach(({ text, messageId }) => {
            this.enqueue(text, messageId)
          })
        }
        
        return true
      } else {
        throw new Error('All unlock attempts failed')
      }
      
    } catch (error) {
      throw error
    }
  }

  isIOS() {
    // Enhanced iOS detection for better reliability
    const userAgent = navigator.userAgent.toLowerCase()
    const isIOSDevice = /ipad|iphone|ipod/.test(userAgent)
    const isMacWithTouch = userAgent.includes('mac') && 'ontouchend' in document
    const isIOSWebKit = /webkit/.test(userAgent) && /mobile/.test(userAgent)
    
    return isIOSDevice || isMacWithTouch || isIOSWebKit
  }

  showIOSPrompt() {
    // Prevent duplicate prompts
    if (document.getElementById('ios-audio-prompt')) {
      return
    }
    
    // Double check we're on iOS and audio isn't unlocked
    if (!this.isIOS() || window.__audioUnlocked) {
      return
    }
    
    const prompt = document.createElement('div')
    prompt.id = 'ios-audio-prompt'
    
    // Enhanced styling for maximum visibility on iOS
    prompt.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: #FF6B35 !important;
      color: white !important;
      padding: 16px 24px !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
      z-index: 999999 !important;
      font-family: -apple-system, system-ui, sans-serif !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      -webkit-tap-highlight-color: rgba(255,255,255,0.3) !important;
      border: 2px solid rgba(255,255,255,0.3) !important;
      min-width: 280px !important;
      text-align: center !important;
      opacity: 1 !important;
      visibility: visible !important;
      display: block !important;
    `
    
    prompt.textContent = '🎵 Tap to Enable Audio'
    
    // Add CSS animation if not already present
    if (!document.getElementById('ios-audio-styles')) {
      const styles = document.createElement('style')
      styles.id = 'ios-audio-styles'
      styles.textContent = `
        @keyframes iosSlideDown {
          from { 
            transform: translateX(-50%) translateY(-100%) !important; 
            opacity: 0 !important; 
          }
          to { 
            transform: translateX(-50%) translateY(0) !important; 
            opacity: 1 !important; 
          }
        }
        #ios-audio-prompt {
          animation: iosSlideDown 0.4s ease-out !important;
        }
        #ios-audio-prompt:active {
          transform: translateX(-50%) scale(0.96) !important;
          background: #E55A2B !important;
        }
      `
      document.head.appendChild(styles)
    }
    
    // Click handler for unlock
    const unlockHandler = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      prompt.style.background = '#4CAF50'
      prompt.textContent = '🔄 Enabling Audio...'
      
      const unlocked = await this.unlockIOSAudio()
      if (unlocked) {
        prompt.style.background = '#4CAF50'
        prompt.textContent = '✅ Audio Ready!'
        setTimeout(() => {
          this.hideIOSPrompt()
        }, 1500)
      } else {
        prompt.style.background = '#FF6B35'
        prompt.textContent = '❌ Try Again'
        setTimeout(() => {
          prompt.textContent = '🎵 Tap to Enable Audio'
          prompt.style.background = '#FF6B35'
        }, 2000)
      }
    }
    
    // Add multiple event types for iOS compatibility
    prompt.addEventListener('click', unlockHandler, { passive: false })
    prompt.addEventListener('touchend', unlockHandler, { passive: false })
    prompt.addEventListener('touchstart', (e) => {
      e.preventDefault()
      prompt.style.transform = 'translateX(-50%) scale(0.96)'
    }, { passive: false })
    
    // Ensure it's added to the body and visible
    document.body.appendChild(prompt)
    
    // Force a reflow to ensure it's rendered
    prompt.offsetHeight
  }

  hideIOSPrompt() {
    const prompt = document.getElementById('ios-audio-prompt')
    if (prompt) {
      prompt.remove()
    }
  }

  ensureAllButtonsVisible() {
    // Find all TTS buttons in the document and ensure they're visible if TTS is enabled
    if (!window.__ttsEnabled) return
    
    const allTTSButtons = document.querySelectorAll('[data-controller*="tts"], [data-tts-button], [data-action*="tts"]')
    allTTSButtons.forEach(button => {
      if (button.classList.contains('hidden')) {
        button.classList.remove('hidden')
      }
      button.style.opacity = '1'
      button.style.visibility = 'visible'
    })
  }
} 