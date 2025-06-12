import { Controller } from "@hotwired/stimulus"

/**
 * Global TTS State Manager
 * Tracks active TTS state by message ID to survive DOM replacements
 */
window.GlobalTTSManager = {
  isActive: false,
  activeMessageId: null,
  allButtons: new Map(),
  
  registerButton(button, messageId = null) {
    if (!messageId) {
      messageId = this.extractMessageId(button)
    }
    
    this.allButtons.set(button, messageId)

    if (this.isActive && this.activeMessageId && !document.getElementById(this.activeMessageId)) {
      this.activeMessageId = messageId
    }
    
    let enabled
    if (window.__ttsEnabled === undefined) {
      enabled = JSON.parse(localStorage.getItem('ttsEnabled') ?? 'true')
      window.__ttsEnabled = enabled
    } else {
      enabled = window.__ttsEnabled
    }
    
    if (enabled) {
      button.classList.remove('hidden')
      button.style.display = 'inline-flex'
      button.style.opacity = '1'
      button.style.visibility = 'visible'
    } else {
      button.classList.add('hidden')
      button.style.display = 'none'
      button.style.opacity = '0'
      button.style.visibility = 'hidden'
      return
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
    let messageId = button.dataset.ttsMessageId
    
    if (!messageId) {
      const messageContainer = button.closest('[id*="chat_message"], [id*="temp_message"]')
      if (messageContainer) {
        messageId = messageContainer.id
      }
    }
    
    if (!messageId) {
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
      hash = hash & hash
    }
    return Math.abs(hash).toString()
  },
  
  setActiveMessage(messageId) {
    this.activeMessageId = messageId
    this.isActive = true
    
    const btn = this.getButtonByMessageId(messageId)
    if (btn) this.setStopState(btn)
    
    this.allButtons.forEach((msg, button) => {
      if (msg !== messageId) this.setSpeakerState(button)
    })
  },
  
  clearActiveMessage() {
    this.activeMessageId = null
    this.isActive = false
    this.updateAllButtons()
  },
  
  updateAllButtons() {
    this.allButtons.forEach((messageId, button) => {
      if (window.__ttsEnabled) {
        button.classList.remove('hidden')
        button.style.display = 'inline-flex'
        button.style.opacity = '1'
        button.style.visibility = 'visible'
      } else {
        button.classList.add('hidden')
        button.style.display = 'none'
        button.style.opacity = '0'
        button.style.visibility = 'hidden'
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
    
    if (window.__ttsEnabled) {
      button.style.opacity = '1'
      button.style.visibility = 'visible'
      button.style.display = button.style.display || 'inline-flex'
    }
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
    
    if (window.__ttsEnabled) {
      button.style.opacity = '1'
      button.style.visibility = 'visible'
      button.style.display = button.style.display || 'inline-flex'
    }
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
 * Global TTS Controller with Google TTS API
 * Manages audio queue with prefetching and iOS compatibility
 */
export default class extends Controller {
  connect() {
    if (window.GlobalTTSInstance) {
      window.GlobalTTSInstance.cleanup()
    }
    
    window.GlobalTTSInstance = this
    
    this.initializeState()
    this.setupEventListeners()
    this.setupIOSAudioUnlock()
    this.createVoiceSelector()
    
    setTimeout(() => {
      this.ensureAllButtonsVisible()
    }, 100)
    
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
    
    const voiceButton = document.getElementById('tts-voice-selector-btn')
    if (voiceButton) {
      voiceButton.remove()
    }
    
    if (window.GlobalTTSInstance === this) {
      window.GlobalTTSInstance = null
    }
  }

  // ===== INITIALIZATION =====

  initializeState() {
    this.queue = []
    this.audioQueue = []
    this.prefetchedAudio = new Map()
    this.speaking = false
    this.processing = false
    this.currentMessageId = null
    this.enabled = JSON.parse(localStorage.getItem('ttsEnabled') ?? 'true')
    window.__ttsEnabled = this.enabled
    
    // iOS compatibility
    this.audioContext = null
    this.isIOSUnlocked = false
    this.pendingTexts = []
    
    // Voice selection
    this.selectedVoice = localStorage.getItem('googleTTSVoice') || 'en-US-Neural2-A'
    this.selectedSpeed = parseFloat(localStorage.getItem('googleTTSSpeed')) || 1.0
    
    // Audio management
    this.currentAudio = null
    this.isPlaying = false
    
    // Duplicate prevention
    this.recentTexts = new Map()
    this.spoken = new Set()
    
    // User interaction tracking
    this.userStopped = false
    this.hasUserGesture = false
    
    // Prefetch management
    this.maxPrefetchItems = 5
    this.prefetchQueue = new Set()
    
    this.initializeAudioContext()
  }

  setupEventListeners() {
    // Remove existing listeners to prevent duplicates
    if (window.TTSEventListenersAdded) {
      window.removeEventListener('tts:toggle', window.TTSToggleHandler)
      window.removeEventListener('tts:add', window.TTSAddHandler) 
      window.removeEventListener('tts:stop', window.TTSStopHandler)
      window.removeEventListener('beforeunload', window.TTSBeforeUnloadHandler)
      window.removeEventListener('tts:enabled', window.TTSEnabledHandler)
      window.removeEventListener('keydown', window.TTSKeydownHandler)
    }
    
    // Create handler functions
    window.TTSToggleHandler = () => this.toggle()
    window.TTSAddHandler = (e) => this.enqueue(e.detail.text, e.detail.messageId)
    window.TTSStopHandler = (e) => {
      const reason = e.detail?.reason || 'event'
      this.stop(reason)
    }
    window.TTSBeforeUnloadHandler = () => this.cleanup()
    window.TTSEnabledHandler = (e) => {
      window.__ttsEnabled = e.detail
      window.GlobalTTSManager.updateAllButtons()
      
      if (!e.detail) {
        console.log('TTS globally disabled via event - stopping all audio')
        this.stop('global_tts_disabled')
      }
    }
    window.TTSKeydownHandler = (e) => {
      // Ctrl/Cmd + Shift + V to open voice selector
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        this.showVoiceSelector()
      }
    }
    
    // Add event listeners
    window.addEventListener('tts:toggle', window.TTSToggleHandler)
    window.addEventListener('tts:add', window.TTSAddHandler)
    window.addEventListener('tts:stop', window.TTSStopHandler)
    window.addEventListener('beforeunload', window.TTSBeforeUnloadHandler)
    window.addEventListener('tts:enabled', window.TTSEnabledHandler)
    window.addEventListener('keydown', window.TTSKeydownHandler)
    
    window.TTSEventListenersAdded = true
    window.TTSEventListenerCount = (window.TTSEventListenerCount || 0) + 1
    
    // Expose voice selector globally
    window.showTTSVoiceSelector = () => this.showVoiceSelector()
  }

  setupUserGestureDetection() {
    const gestureEvents = ['click', 'touchstart', 'keydown', 'mousedown']
    const gestureHandler = () => {
      if (!this.hasUserGesture) {
        this.markUserGesture()
      }
    }
    
    gestureEvents.forEach(event => {
      document.addEventListener(event, gestureHandler, { 
        passive: true, 
        capture: true 
      })
    })
    
    this.gestureHandler = gestureHandler
    this.gestureEvents = gestureEvents
  }

  // ===== CONTENT DETECTION =====

  // ===== PREFETCHING =====

  async prefetchText(text) {
    const key = this.normalizeText(text)
    if (this.prefetchedAudio.has(key) || this.prefetchQueue.has(key)) return
    
    this.prefetchQueue.add(key)
    try {
      this.prefetchedAudio.set(key, text)
    } catch (error) {
      console.error('TTS prefetch failed:', error.message)
    } finally {
      this.prefetchQueue.delete(key)
    }
  }

  // ===== QUEUE MANAGEMENT =====

  async enqueue(text, messageId = null) {
    if (!this.enabled || !text) return
    
    // Check for iOS audio unlock
    if (this.isIOS() && !this.isIOSUnlocked) {
      this.pendingTexts.push({ text, messageId })
      return
    }
    
    // Clean text before processing
    const cleanedText = this.cleanTextForTTS(text)
    if (!cleanedText.trim()) return
    
    const normalizedText = this.normalizeText(cleanedText)
    
    // Prevent duplicates
    if (this.isDuplicate(normalizedText)) {
        return
      }
      
    this.markAsRecent(normalizedText)
    
    // Split text into sentences for better streaming
    const sentences = this.splitIntoSentences(cleanedText)
    
    for (const sentence of sentences) {
      if (sentence.trim()) {
        const queueItem = {
          text: sentence.trim(),
          messageId: messageId,
          normalizedText: this.normalizeText(sentence),
          audioUrl: null,
          prefetched: false
        }
        
        this.queue.push(queueItem)
      }
    }
    
    if (!this.processing) {
      this.startProcessing(messageId)
    }
    
    // Start prefetching
    this.prefetchNext()
    
    // Process queue
    this.processQueue()
  }

  cleanTextForTTS(text) {
    return text
      // Remove emojis (comprehensive Unicode ranges)
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map Symbols
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Regional Indicator Symbols (flags)
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols (☀️ ⭐ etc)
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
      
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')        // **bold** -> bold
      .replace(/\*(.*?)\*/g, '$1')            // *italic* -> italic
      .replace(/`(.*?)`/g, '$1')             // `code` -> code
      .replace(/~~(.*?)~~/g, '$1')           // ~~strikethrough~~ -> strikethrough
      .replace(/#{1,6}\s*(.*)/g, '$1')       // # Header -> Header
      
      // Remove special characters that shouldn't be read
      .replace(/[#@&%$€£¥]/g, '')            // Currency and symbols
      .replace(/[↑↓←→↔]/g, '')               // Arrows
      .replace(/[★☆✓✗✘]/g, '')              // Stars and checkmarks
      .replace(/[♠♣♥♦]/g, '')                // Card suits
      .replace(/[♀♂]/g, '')                  // Gender symbols
      .replace(/[©®™]/g, '')                 // Copyright symbols
      
      // Clean up multiple spaces and normalize punctuation
      .replace(/\s+/g, ' ')                  // Multiple spaces -> single space
      .replace(/\.\.\./g, '.')               // ... -> .
      .replace(/[!]{2,}/g, '!')              // Multiple ! -> single !
      .replace(/[?]{2,}/g, '?')              // Multiple ? -> single ?
      .replace(/\n\s*\n/g, '. ')             // Double newlines -> period + space
      .replace(/\n/g, '. ')                  // Single newlines -> period + space
      
      // Remove parenthetical content that's often metadata
      .replace(/\([^)]*\)/g, '')             // Remove content in parentheses
      .replace(/\[[^\]]*\]/g, '')            // Remove content in brackets
      
      // Clean up final result
      .replace(/\s*[.]{2,}\s*/g, '. ')       // Clean up dots
      .replace(/\s*[,]{2,}\s*/g, ', ')       // Clean up commas
      .replace(/\s+/g, ' ')                  // Final space cleanup
      .trim()
  }

  isDuplicate(normalizedText) {
    // Check if recently processed
    if (this.recentTexts.has(normalizedText)) {
      const lastTime = this.recentTexts.get(normalizedText)
      if (Date.now() - lastTime < 1000) { // 1 second window
        return true
      }
    }
    
    // Check if already in queue
    return this.queue.some(item => item.normalizedText === normalizedText) ||
           this.spoken.has(normalizedText)
  }
  
  markAsRecent(normalizedText) {
    this.recentTexts.set(normalizedText, Date.now())
    
    // Cleanup old entries
    for (const [text, time] of this.recentTexts.entries()) {
      if (Date.now() - time > 5000) { // 5 second cleanup
        this.recentTexts.delete(text)
      }
    }
  }

  startProcessing(messageId) {
    if (this.processing && this.currentMessageId !== messageId) {
      this.stop('new_message')
    }
    
    this.processing = true
    this.currentMessageId = messageId
    this.userStopped = false
    
    window.GlobalTTSManager.setActiveMessage(messageId)
    console.log(`Started TTS processing for message: ${messageId}`)
  }

  async processQueue() {
    if (this.queue.length === 0) {
      if (this.processing && !this.isPlaying) {
        this.endProcessing()
      }
      return
    }
    
    if (this.isPlaying || this.userStopped || !this.enabled) {
      return
    }
    
    const queueItem = this.queue.shift()
    console.log(`Processing: "${queueItem.text.substring(0, 50)}..."`)
    
    try {
      await this.playAudioItem(queueItem)
      this.spoken.add(queueItem.normalizedText)
      
    } catch (error) {
      console.error('Audio playback failed:', error)
      // Continue with next item
    }
    
    // Continue processing
    if (!this.userStopped && this.enabled) {
      setTimeout(() => this.processQueue(), 100)
    }
  }

  shouldRetryPlayback(error, retryCount) {
    if (error.message.includes('interrupted') || error.message.includes('cancelled')) {
      return false
    }
    
    if (this.userStopped) {
      return false
    }
    
    const retryableErrors = [
      'autoplay',
      'gesture',
      'voice',
      'network',
      'temporary',
      'synthesis'
    ]
    
    return retryableErrors.some(errorType => 
      error.message.toLowerCase().includes(errorType)
    )
  }

  handlePlaybackFailure(text, messageId, error) {
    const key = this.normalizeText(text)
    this.spoken.add(key)
    
    if (error.message.toLowerCase().includes('autoplay') || 
        error.message.toLowerCase().includes('gesture')) {
      this.promptForUserGesture()
    }
    
    const btn = window.GlobalTTSManager.getButtonByMessageId(messageId)
    if (btn) {
      window.GlobalTTSManager.setSpeakerState(btn)
    }
  }

  promptForUserGesture() {
    if (this.hasPromptedForGesture) return
    this.hasPromptedForGesture = true
    
    console.info('TTS requires user interaction - click anywhere to enable autoplay')
    
    const gestureEvents = ['click', 'touchstart', 'keydown']
    const gestureHandler = () => {
      this.markUserGesture()
      gestureEvents.forEach(event => {
        document.removeEventListener(event, gestureHandler, { capture: true })
      })
    }
    
    gestureEvents.forEach(event => {
      document.addEventListener(event, gestureHandler, { 
        capture: true, 
        once: true, 
        passive: true 
      })
    })
  }

  endProcessing() {
    this.processing = false
    this.currentMessageId = null
    window.GlobalTTSManager.clearActiveMessage()
    
    console.log('TTS processing completed')
    
    // Enable hands-free chat if on chat page
    if (this.queue.length === 0 && !this.isPlaying) {
      this.enableHandsFreeChat()
    }
  }

  enableHandsFreeChat() {
    if (!window.__ttsEnabled) return
    
    const chatMessagesContainer = document.getElementById('chat_messages')
    if (!chatMessagesContainer) return
    
    const voiceToggleBtn = document.getElementById('voice-toggle-btn')
    if (!voiceToggleBtn || voiceToggleBtn.disabled) return
    
    const recorder = window.voiceRecorderInstance
    if (!recorder || recorder.isRecording) return
    
    setTimeout(() => {
      if (window.__ttsEnabled && !recorder.isRecording && !this.processing) {
        console.log('Starting hands-free chat')
        voiceToggleBtn.click()
      }
    }, 1500)
  }

  // ===== AUDIO PLAYBACK =====

  async playAudioItem(queueItem) {
    this.isPlaying = true
    
    try {
      let audioUrl = queueItem.audioUrl
      
      // Fetch audio if not prefetched
      if (!audioUrl) {
        console.log('Audio not prefetched, fetching now...')
        audioUrl = await this.fetchGoogleTTS(queueItem.text)
      }
      
      await this.playAudio(audioUrl)
      
    } finally {
      this.isPlaying = false
      
      // Cleanup audio URL to free memory
      if (queueItem.audioUrl) {
        URL.revokeObjectURL(queueItem.audioUrl)
      }
    }
  }

  async playAudio(audioUrl) {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      this.currentAudio = audio
      
      audio.preload = 'auto'
      audio.src = audioUrl
      
      audio.onloadeddata = () => {
        console.log('Audio loaded, starting playback')
      }
      
      audio.onended = () => {
        console.log('Audio playback completed')
        this.currentAudio = null
        resolve()
      }
      
      audio.onerror = (error) => {
        console.error('Audio playback error:', error)
        this.currentAudio = null
        reject(new Error(`Audio playback failed: ${error.message}`))
      }
      
      audio.onpause = () => {
        if (!this.userStopped) {
          console.log('Audio paused unexpectedly')
        }
      }
      
      // Start playback
      audio.play().catch(error => {
        console.error('Audio play failed:', error)
        this.currentAudio = null
        reject(error)
      })
    })
  }

  splitIntoSentences(text) {
    // Text is already cleaned by cleanTextForTTS, so just split by sentence boundaries
    const sentences = text.split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.trim().length > 0)
    
    // If no sentences found, return the whole text
    return sentences.length > 0 ? sentences : [text.trim()]
  }

  async prefetchNext() {
    if (this.prefetchQueue.size >= this.maxPrefetchItems) return
    
    // Find next unprefetched item
    const nextItem = this.queue.find(item => !item.prefetched && !this.prefetchQueue.has(item.normalizedText))
    
    if (!nextItem) return
    
    this.prefetchQueue.add(nextItem.normalizedText)
    
    try {
      console.log(`Prefetching: "${nextItem.text.substring(0, 50)}..."`)
      const audioUrl = await this.fetchGoogleTTS(nextItem.text)
      
      nextItem.audioUrl = audioUrl
      nextItem.prefetched = true
      this.prefetchedAudio.set(nextItem.normalizedText, audioUrl)
      
      console.log('Prefetch completed successfully')
      
      // Prefetch next item
      setTimeout(() => this.prefetchNext(), 100)
      
    } catch (error) {
      console.error('Prefetch failed:', error)
    } finally {
      this.prefetchQueue.delete(nextItem.normalizedText)
    }
  }

  processPendingTexts() {
    if (this.pendingTexts.length === 0) return
    
    console.log(`Processing ${this.pendingTexts.length} pending texts`)
    const pending = [...this.pendingTexts]
    this.pendingTexts = []
    
    pending.forEach(({ text, messageId }) => {
      this.enqueue(text, messageId)
    })
  }

  // ===== GOOGLE TTS API =====

  async fetchGoogleTTS(text, voice = null, speed = null) {
    const selectedVoice = voice || this.selectedVoice
    const selectedSpeed = speed || this.selectedSpeed
    
    try {
      const response = await fetch('/api/google_tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.getCSRFToken()
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          speed: selectedSpeed
        })
      })
      
      if (!response.ok) {
        throw new Error(`TTS API failed: ${response.status} ${response.statusText}`)
      }
      
      const audioBlob = await response.blob()
      return URL.createObjectURL(audioBlob)
    } catch (error) {
      console.error('Google TTS fetch failed:', error)
      throw error
    }
  }

  // ===== UTILITIES =====

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.!?]+$/, '')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ''
  }

  ensureAllButtonsVisible() {
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

  // ===== CONTROLS =====

  stop(reason = 'user') {
    // Always allow stopping when disabled by user action
    if (reason === 'toggle_disabled_user_action' || 
        reason === 'global_toggle_disabled' || 
        reason === 'global_tts_disabled') {
      console.log(`TTS disabled by user (${reason}) - stopping audio`)
    } else if (window.__ttsProtected) {
      console.log('TTS is protected - ignoring stop request')
      return
    }
    
    this.userStopped = true
    console.log(`TTS stop requested by ${reason}`)
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    
    this.isPlaying = false
    this.processing = false
    this.queue = []
    this.audioQueue = []
    this.currentMessageId = null
    
    window.GlobalTTSManager.clearActiveMessage()
    
    // Cleanup prefetched audio URLs
    this.prefetchedAudio.forEach(url => URL.revokeObjectURL(url))
    this.prefetchedAudio.clear()
    
    // Reset user stop flag
    setTimeout(() => {
      this.userStopped = false
      console.log('TTS stop flag reset')
    }, 500)
  }

  toggle() {
    this.enabled = !this.enabled
    localStorage.setItem('ttsEnabled', JSON.stringify(this.enabled))
    window.dispatchEvent(new CustomEvent('tts:enabled', { detail: this.enabled }))
    
    if (!this.enabled) {
      console.log('TTS globally disabled - stopping all audio')
      this.stop('global_toggle_disabled')
    }
  }

  // ===== VOICE SELECTION =====

  createVoiceSelector() {
    const chatMessagesContainer = document.getElementById('chat_messages')
    if (!chatMessagesContainer) return

    const existingButton = document.getElementById('tts-voice-selector-btn')
    if (existingButton) existingButton.remove()

    // Style to match the clear chat button
    const buttonClasses = 'inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-1.5 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-medium rounded-full shadow transition duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400/50 text-xs sm:text-xs ml-2'

    const button = document.createElement('button')
    button.id = 'tts-voice-selector-btn'
    button.className = buttonClasses
    button.innerHTML = `
      <svg class="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
      </svg>
      <span class="hidden sm:inline">Voice</span>
      <span class="sm:hidden">Voice</span>
    `
    button.title = 'Select Google TTS Voice (Ctrl+Shift+V)'
    
    button.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.showVoiceSelector()
    }

    // Find container and add button
    const targetContainer = this.findVoiceButtonContainer()
    if (targetContainer) {
      targetContainer.appendChild(button)
      } else {
      button.classList.add('fixed', 'top-5', 'right-5', 'z-50')
      document.body.appendChild(button)
    }
  }

  findVoiceButtonContainer() {
    // Look for the clear chat button container specifically
    const clearChatButton = document.querySelector('button[data-turbo-confirm*="clear"]') || 
                           document.querySelector('form[action*="clear"]') ||
                           document.querySelector('[method="delete"]')
    
    if (clearChatButton) {
      return clearChatButton.parentElement
    }

    // Fallback to other containers
    const containerSelectors = [
      '.chat-controls',
      '.chat-actions', 
      '.message-controls',
      '.toolbar-buttons',
      '.action-buttons',
      '.flex.items-center.space-x-2',
      '.flex.gap-2'
    ]
    
    for (const selector of containerSelectors) {
      const container = document.querySelector(selector)
      if (container && container.querySelector('button')) {
        return container
      }
    }

    return document.querySelector('.chat-header') || document.querySelector('header')
  }

  async showVoiceSelector() {
    const voices = this.getGoogleVoices()
    const modal = this.createVoiceSelectorModal(voices)
    document.body.appendChild(modal)
    setTimeout(() => modal.classList.add('show'), 10)
  }

  getGoogleVoices() {
    // Complete Google Cloud TTS voices list based on official documentation
    const allVoices = [
      // English US - Chirp 3 HD (Latest generation for conversational agents)
      { name: 'en-US-Chirp3-HD-Aoede', lang: 'en-US', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'en-US-Chirp3-HD-Charon', lang: 'en-US', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'en-US-Chirp3-HD-Fenrir', lang: 'en-US', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'en-US-Chirp3-HD-Kore', lang: 'en-US', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'en-US-Chirp3-HD-Leda', lang: 'en-US', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'en-US-Chirp3-HD-Orus', lang: 'en-US', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'en-US-Chirp3-HD-Puck', lang: 'en-US', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'en-US-Chirp3-HD-Zephyr', lang: 'en-US', gender: 'Female', type: 'Chirp3 HD' },

      // English US - Chirp HD (Optimized by LLMs for conversations)
      { name: 'en-US-Chirp-HD-A', lang: 'en-US', gender: 'Female', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-B', lang: 'en-US', gender: 'Male', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-C', lang: 'en-US', gender: 'Female', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-D', lang: 'en-US', gender: 'Male', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-F', lang: 'en-US', gender: 'Female', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-G', lang: 'en-US', gender: 'Female', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-H', lang: 'en-US', gender: 'Female', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-I', lang: 'en-US', gender: 'Male', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-J', lang: 'en-US', gender: 'Male', type: 'Chirp HD' },
      { name: 'en-US-Chirp-HD-O', lang: 'en-US', gender: 'Female', type: 'Chirp HD' },

      // English US - Neural2
      { name: 'en-US-Neural2-A', lang: 'en-US', gender: 'Female', type: 'Neural2' },
      { name: 'en-US-Neural2-B', lang: 'en-US', gender: 'Male', type: 'Neural2' },
      { name: 'en-US-Neural2-C', lang: 'en-US', gender: 'Female', type: 'Neural2' },
      { name: 'en-US-Neural2-D', lang: 'en-US', gender: 'Male', type: 'Neural2' },
      { name: 'en-US-Neural2-E', lang: 'en-US', gender: 'Female', type: 'Neural2' },
      { name: 'en-US-Neural2-F', lang: 'en-US', gender: 'Male', type: 'Neural2' },
      { name: 'en-US-Neural2-G', lang: 'en-US', gender: 'Female', type: 'Neural2' },
      { name: 'en-US-Neural2-H', lang: 'en-US', gender: 'Female', type: 'Neural2' },
      { name: 'en-US-Neural2-I', lang: 'en-US', gender: 'Male', type: 'Neural2' },
      { name: 'en-US-Neural2-J', lang: 'en-US', gender: 'Male', type: 'Neural2' },
      { name: 'en-US-Studio-M', lang: 'en-US', gender: 'Male', type: 'Studio' },
      { name: 'en-US-Studio-O', lang: 'en-US', gender: 'Female', type: 'Studio' },
      { name: 'en-US-Wavenet-A', lang: 'en-US', gender: 'Male', type: 'WaveNet' },
      { name: 'en-US-Wavenet-B', lang: 'en-US', gender: 'Male', type: 'WaveNet' },
      { name: 'en-US-Wavenet-C', lang: 'en-US', gender: 'Female', type: 'WaveNet' },
      { name: 'en-US-Wavenet-D', lang: 'en-US', gender: 'Male', type: 'WaveNet' },
      { name: 'en-US-Wavenet-E', lang: 'en-US', gender: 'Female', type: 'WaveNet' },
      { name: 'en-US-Wavenet-F', lang: 'en-US', gender: 'Female', type: 'WaveNet' },
      { name: 'en-US-Wavenet-G', lang: 'en-US', gender: 'Female', type: 'WaveNet' },
      { name: 'en-US-Wavenet-H', lang: 'en-US', gender: 'Female', type: 'WaveNet' },
      { name: 'en-US-Wavenet-I', lang: 'en-US', gender: 'Male', type: 'WaveNet' },
      { name: 'en-US-Wavenet-J', lang: 'en-US', gender: 'Male', type: 'WaveNet' },

      // English GB
      { name: 'en-GB-Neural2-A', lang: 'en-GB', gender: 'Female', type: 'Neural2' },
      { name: 'en-GB-Neural2-B', lang: 'en-GB', gender: 'Male', type: 'Neural2' },
      { name: 'en-GB-Neural2-C', lang: 'en-GB', gender: 'Female', type: 'Neural2' },
      { name: 'en-GB-Neural2-D', lang: 'en-GB', gender: 'Male', type: 'Neural2' },
      { name: 'en-GB-Neural2-F', lang: 'en-GB', gender: 'Female', type: 'Neural2' },
      { name: 'en-GB-Studio-B', lang: 'en-GB', gender: 'Male', type: 'Studio' },
      { name: 'en-GB-Studio-C', lang: 'en-GB', gender: 'Female', type: 'Studio' },
      { name: 'en-GB-Wavenet-A', lang: 'en-GB', gender: 'Female', type: 'WaveNet' },
      { name: 'en-GB-Wavenet-B', lang: 'en-GB', gender: 'Male', type: 'WaveNet' },
      { name: 'en-GB-Wavenet-C', lang: 'en-GB', gender: 'Female', type: 'WaveNet' },
      { name: 'en-GB-Wavenet-D', lang: 'en-GB', gender: 'Male', type: 'WaveNet' },
      { name: 'en-GB-Wavenet-F', lang: 'en-GB', gender: 'Female', type: 'WaveNet' },

      // English AU
      { name: 'en-AU-Neural2-A', lang: 'en-AU', gender: 'Female', type: 'Neural2' },
      { name: 'en-AU-Neural2-B', lang: 'en-AU', gender: 'Male', type: 'Neural2' },
      { name: 'en-AU-Neural2-C', lang: 'en-AU', gender: 'Female', type: 'Neural2' },
      { name: 'en-AU-Neural2-D', lang: 'en-AU', gender: 'Male', type: 'Neural2' },
      { name: 'en-AU-Wavenet-A', lang: 'en-AU', gender: 'Female', type: 'WaveNet' },
      { name: 'en-AU-Wavenet-B', lang: 'en-AU', gender: 'Male', type: 'WaveNet' },
      { name: 'en-AU-Wavenet-C', lang: 'en-AU', gender: 'Female', type: 'WaveNet' },
      { name: 'en-AU-Wavenet-D', lang: 'en-AU', gender: 'Male', type: 'WaveNet' },

      // French FR - Chirp 3 HD
      { name: 'fr-FR-Chirp3-HD-Aoede', lang: 'fr-FR', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'fr-FR-Chirp3-HD-Charon', lang: 'fr-FR', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'fr-FR-Chirp3-HD-Fenrir', lang: 'fr-FR', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'fr-FR-Chirp3-HD-Kore', lang: 'fr-FR', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'fr-FR-Chirp3-HD-Leda', lang: 'fr-FR', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'fr-FR-Chirp3-HD-Orus', lang: 'fr-FR', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'fr-FR-Chirp3-HD-Puck', lang: 'fr-FR', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'fr-FR-Chirp3-HD-Zephyr', lang: 'fr-FR', gender: 'Female', type: 'Chirp3 HD' },

      // French FR - Neural2
      { name: 'fr-FR-Neural2-A', lang: 'fr-FR', gender: 'Female', type: 'Neural2' },
      { name: 'fr-FR-Neural2-B', lang: 'fr-FR', gender: 'Male', type: 'Neural2' },
      { name: 'fr-FR-Neural2-C', lang: 'fr-FR', gender: 'Female', type: 'Neural2' },
      { name: 'fr-FR-Neural2-D', lang: 'fr-FR', gender: 'Male', type: 'Neural2' },
      { name: 'fr-FR-Neural2-E', lang: 'fr-FR', gender: 'Female', type: 'Neural2' },
      { name: 'fr-FR-Studio-A', lang: 'fr-FR', gender: 'Female', type: 'Studio' },
      { name: 'fr-FR-Studio-D', lang: 'fr-FR', gender: 'Male', type: 'Studio' },
      { name: 'fr-FR-Wavenet-A', lang: 'fr-FR', gender: 'Female', type: 'WaveNet' },
      { name: 'fr-FR-Wavenet-B', lang: 'fr-FR', gender: 'Male', type: 'WaveNet' },
      { name: 'fr-FR-Wavenet-C', lang: 'fr-FR', gender: 'Female', type: 'WaveNet' },
      { name: 'fr-FR-Wavenet-D', lang: 'fr-FR', gender: 'Male', type: 'WaveNet' },
      { name: 'fr-FR-Wavenet-E', lang: 'fr-FR', gender: 'Female', type: 'WaveNet' },

      // French CA
      { name: 'fr-CA-Neural2-A', lang: 'fr-CA', gender: 'Female', type: 'Neural2' },
      { name: 'fr-CA-Neural2-B', lang: 'fr-CA', gender: 'Male', type: 'Neural2' },
      { name: 'fr-CA-Neural2-C', lang: 'fr-CA', gender: 'Female', type: 'Neural2' },
      { name: 'fr-CA-Neural2-D', lang: 'fr-CA', gender: 'Male', type: 'Neural2' },
      { name: 'fr-CA-Wavenet-A', lang: 'fr-CA', gender: 'Female', type: 'WaveNet' },
      { name: 'fr-CA-Wavenet-B', lang: 'fr-CA', gender: 'Male', type: 'WaveNet' },
      { name: 'fr-CA-Wavenet-C', lang: 'fr-CA', gender: 'Female', type: 'WaveNet' },
      { name: 'fr-CA-Wavenet-D', lang: 'fr-CA', gender: 'Male', type: 'WaveNet' },

      // Spanish ES - Chirp 3 HD
      { name: 'es-ES-Chirp3-HD-Aoede', lang: 'es-ES', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'es-ES-Chirp3-HD-Charon', lang: 'es-ES', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'es-ES-Chirp3-HD-Fenrir', lang: 'es-ES', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'es-ES-Chirp3-HD-Kore', lang: 'es-ES', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'es-ES-Chirp3-HD-Leda', lang: 'es-ES', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'es-ES-Chirp3-HD-Orus', lang: 'es-ES', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'es-ES-Chirp3-HD-Puck', lang: 'es-ES', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'es-ES-Chirp3-HD-Zephyr', lang: 'es-ES', gender: 'Female', type: 'Chirp3 HD' },

      // Spanish ES - Neural2
      { name: 'es-ES-Neural2-A', lang: 'es-ES', gender: 'Female', type: 'Neural2' },
      { name: 'es-ES-Neural2-B', lang: 'es-ES', gender: 'Male', type: 'Neural2' },
      { name: 'es-ES-Neural2-C', lang: 'es-ES', gender: 'Female', type: 'Neural2' },
      { name: 'es-ES-Neural2-D', lang: 'es-ES', gender: 'Female', type: 'Neural2' },
      { name: 'es-ES-Neural2-E', lang: 'es-ES', gender: 'Female', type: 'Neural2' },
      { name: 'es-ES-Neural2-F', lang: 'es-ES', gender: 'Male', type: 'Neural2' },
      { name: 'es-ES-Wavenet-B', lang: 'es-ES', gender: 'Male', type: 'WaveNet' },
      { name: 'es-ES-Wavenet-C', lang: 'es-ES', gender: 'Female', type: 'WaveNet' },
      { name: 'es-ES-Wavenet-D', lang: 'es-ES', gender: 'Female', type: 'WaveNet' },

      // Spanish US
      { name: 'es-US-Neural2-A', lang: 'es-US', gender: 'Female', type: 'Neural2' },
      { name: 'es-US-Neural2-B', lang: 'es-US', gender: 'Male', type: 'Neural2' },
      { name: 'es-US-Neural2-C', lang: 'es-US', gender: 'Male', type: 'Neural2' },
      { name: 'es-US-Studio-B', lang: 'es-US', gender: 'Male', type: 'Studio' },
      { name: 'es-US-Wavenet-A', lang: 'es-US', gender: 'Female', type: 'WaveNet' },
      { name: 'es-US-Wavenet-B', lang: 'es-US', gender: 'Male', type: 'WaveNet' },
      { name: 'es-US-Wavenet-C', lang: 'es-US', gender: 'Male', type: 'WaveNet' },

      // German DE - Chirp 3 HD
      { name: 'de-DE-Chirp3-HD-Aoede', lang: 'de-DE', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'de-DE-Chirp3-HD-Charon', lang: 'de-DE', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'de-DE-Chirp3-HD-Fenrir', lang: 'de-DE', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'de-DE-Chirp3-HD-Kore', lang: 'de-DE', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'de-DE-Chirp3-HD-Leda', lang: 'de-DE', gender: 'Female', type: 'Chirp3 HD' },
      { name: 'de-DE-Chirp3-HD-Orus', lang: 'de-DE', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'de-DE-Chirp3-HD-Puck', lang: 'de-DE', gender: 'Male', type: 'Chirp3 HD' },
      { name: 'de-DE-Chirp3-HD-Zephyr', lang: 'de-DE', gender: 'Female', type: 'Chirp3 HD' },

      // German DE - Neural2
      { name: 'de-DE-Neural2-A', lang: 'de-DE', gender: 'Female', type: 'Neural2' },
      { name: 'de-DE-Neural2-B', lang: 'de-DE', gender: 'Male', type: 'Neural2' },
      { name: 'de-DE-Neural2-C', lang: 'de-DE', gender: 'Female', type: 'Neural2' },
      { name: 'de-DE-Neural2-D', lang: 'de-DE', gender: 'Male', type: 'Neural2' },
      { name: 'de-DE-Neural2-F', lang: 'de-DE', gender: 'Female', type: 'Neural2' },
      { name: 'de-DE-Studio-B', lang: 'de-DE', gender: 'Male', type: 'Studio' },
      { name: 'de-DE-Wavenet-A', lang: 'de-DE', gender: 'Female', type: 'WaveNet' },
      { name: 'de-DE-Wavenet-B', lang: 'de-DE', gender: 'Male', type: 'WaveNet' },
      { name: 'de-DE-Wavenet-C', lang: 'de-DE', gender: 'Female', type: 'WaveNet' },
      { name: 'de-DE-Wavenet-D', lang: 'de-DE', gender: 'Male', type: 'WaveNet' },
      { name: 'de-DE-Wavenet-F', lang: 'de-DE', gender: 'Female', type: 'WaveNet' },

      // Italian IT
      { name: 'it-IT-Neural2-A', lang: 'it-IT', gender: 'Female', type: 'Neural2' },
      { name: 'it-IT-Neural2-C', lang: 'it-IT', gender: 'Male', type: 'Neural2' },
      { name: 'it-IT-Wavenet-A', lang: 'it-IT', gender: 'Female', type: 'WaveNet' },
      { name: 'it-IT-Wavenet-B', lang: 'it-IT', gender: 'Female', type: 'WaveNet' },
      { name: 'it-IT-Wavenet-C', lang: 'it-IT', gender: 'Male', type: 'WaveNet' },
      { name: 'it-IT-Wavenet-D', lang: 'it-IT', gender: 'Female', type: 'WaveNet' },

      // Portuguese BR
      { name: 'pt-BR-Neural2-A', lang: 'pt-BR', gender: 'Female', type: 'Neural2' },
      { name: 'pt-BR-Neural2-B', lang: 'pt-BR', gender: 'Male', type: 'Neural2' },
      { name: 'pt-BR-Neural2-C', lang: 'pt-BR', gender: 'Female', type: 'Neural2' },
      { name: 'pt-BR-Wavenet-A', lang: 'pt-BR', gender: 'Female', type: 'WaveNet' },
      { name: 'pt-BR-Wavenet-B', lang: 'pt-BR', gender: 'Male', type: 'WaveNet' },
      { name: 'pt-BR-Wavenet-C', lang: 'pt-BR', gender: 'Female', type: 'WaveNet' },

      // Portuguese PT
      { name: 'pt-PT-Wavenet-A', lang: 'pt-PT', gender: 'Female', type: 'WaveNet' },
      { name: 'pt-PT-Wavenet-B', lang: 'pt-PT', gender: 'Male', type: 'WaveNet' },
      { name: 'pt-PT-Wavenet-C', lang: 'pt-PT', gender: 'Male', type: 'WaveNet' },
      { name: 'pt-PT-Wavenet-D', lang: 'pt-PT', gender: 'Female', type: 'WaveNet' },

      // Japanese JA
      { name: 'ja-JP-Neural2-B', lang: 'ja-JP', gender: 'Female', type: 'Neural2' },
      { name: 'ja-JP-Neural2-C', lang: 'ja-JP', gender: 'Male', type: 'Neural2' },
      { name: 'ja-JP-Neural2-D', lang: 'ja-JP', gender: 'Male', type: 'Neural2' },
      { name: 'ja-JP-Wavenet-A', lang: 'ja-JP', gender: 'Female', type: 'WaveNet' },
      { name: 'ja-JP-Wavenet-B', lang: 'ja-JP', gender: 'Female', type: 'WaveNet' },
      { name: 'ja-JP-Wavenet-C', lang: 'ja-JP', gender: 'Male', type: 'WaveNet' },
      { name: 'ja-JP-Wavenet-D', lang: 'ja-JP', gender: 'Male', type: 'WaveNet' },

      // Korean KO
      { name: 'ko-KR-Neural2-A', lang: 'ko-KR', gender: 'Female', type: 'Neural2' },
      { name: 'ko-KR-Neural2-B', lang: 'ko-KR', gender: 'Female', type: 'Neural2' },
      { name: 'ko-KR-Neural2-C', lang: 'ko-KR', gender: 'Male', type: 'Neural2' },
      { name: 'ko-KR-Wavenet-A', lang: 'ko-KR', gender: 'Female', type: 'WaveNet' },
      { name: 'ko-KR-Wavenet-B', lang: 'ko-KR', gender: 'Female', type: 'WaveNet' },
      { name: 'ko-KR-Wavenet-C', lang: 'ko-KR', gender: 'Male', type: 'WaveNet' },
      { name: 'ko-KR-Wavenet-D', lang: 'ko-KR', gender: 'Male', type: 'WaveNet' },

      // Chinese CN
      { name: 'zh-CN-Wavenet-A', lang: 'zh-CN', gender: 'Female', type: 'WaveNet' },
      { name: 'zh-CN-Wavenet-B', lang: 'zh-CN', gender: 'Male', type: 'WaveNet' },
      { name: 'zh-CN-Wavenet-C', lang: 'zh-CN', gender: 'Male', type: 'WaveNet' },
      { name: 'zh-CN-Wavenet-D', lang: 'zh-CN', gender: 'Female', type: 'WaveNet' },

      // Chinese TW
      { name: 'zh-TW-Wavenet-A', lang: 'zh-TW', gender: 'Female', type: 'WaveNet' },
      { name: 'zh-TW-Wavenet-B', lang: 'zh-TW', gender: 'Male', type: 'WaveNet' },
      { name: 'zh-TW-Wavenet-C', lang: 'zh-TW', gender: 'Male', type: 'WaveNet' },

      // Dutch NL
      { name: 'nl-NL-Wavenet-A', lang: 'nl-NL', gender: 'Female', type: 'WaveNet' },
      { name: 'nl-NL-Wavenet-B', lang: 'nl-NL', gender: 'Male', type: 'WaveNet' },
      { name: 'nl-NL-Wavenet-C', lang: 'nl-NL', gender: 'Male', type: 'WaveNet' },
      { name: 'nl-NL-Wavenet-D', lang: 'nl-NL', gender: 'Female', type: 'WaveNet' },
      { name: 'nl-NL-Wavenet-E', lang: 'nl-NL', gender: 'Female', type: 'WaveNet' },

      // Russian RU
      { name: 'ru-RU-Wavenet-A', lang: 'ru-RU', gender: 'Female', type: 'WaveNet' },
      { name: 'ru-RU-Wavenet-B', lang: 'ru-RU', gender: 'Male', type: 'WaveNet' },
      { name: 'ru-RU-Wavenet-C', lang: 'ru-RU', gender: 'Female', type: 'WaveNet' },
      { name: 'ru-RU-Wavenet-D', lang: 'ru-RU', gender: 'Male', type: 'WaveNet' },
      { name: 'ru-RU-Wavenet-E', lang: 'ru-RU', gender: 'Female', type: 'WaveNet' },

      // Arabic AR
      { name: 'ar-XA-Wavenet-A', lang: 'ar-XA', gender: 'Female', type: 'WaveNet' },
      { name: 'ar-XA-Wavenet-B', lang: 'ar-XA', gender: 'Male', type: 'WaveNet' },
      { name: 'ar-XA-Wavenet-C', lang: 'ar-XA', gender: 'Male', type: 'WaveNet' },

      // Hindi HI
      { name: 'hi-IN-Neural2-A', lang: 'hi-IN', gender: 'Female', type: 'Neural2' },
      { name: 'hi-IN-Neural2-B', lang: 'hi-IN', gender: 'Male', type: 'Neural2' },
      { name: 'hi-IN-Neural2-C', lang: 'hi-IN', gender: 'Male', type: 'Neural2' },
      { name: 'hi-IN-Neural2-D', lang: 'hi-IN', gender: 'Female', type: 'Neural2' },
      { name: 'hi-IN-Wavenet-A', lang: 'hi-IN', gender: 'Female', type: 'WaveNet' },
      { name: 'hi-IN-Wavenet-B', lang: 'hi-IN', gender: 'Male', type: 'WaveNet' },
      { name: 'hi-IN-Wavenet-C', lang: 'hi-IN', gender: 'Male', type: 'WaveNet' },
      { name: 'hi-IN-Wavenet-D', lang: 'hi-IN', gender: 'Female', type: 'WaveNet' },

      // More languages can be added based on the full documentation...
    ]

    // Get browser language
    const browserLang = navigator.language || navigator.userLanguage || 'en-US'
    const mainLang = browserLang.split('-')[0] // e.g., 'fr' from 'fr-FR'
    
    // Filter voices by browser language
    const languageFilteredVoices = allVoices.filter(voice => {
      const voiceLang = voice.lang.split('-')[0]
      return voiceLang === mainLang
    })
    
    // If no voices found for browser language, fallback to English
    if (languageFilteredVoices.length === 0) {
      return allVoices.filter(voice => voice.lang.startsWith('en-'))
    }
    
    // Sort by type priority (Chirp3 HD > Chirp HD > Neural2 > Studio > WaveNet > Standard) and then by name
    const typePriority = { 'Chirp3 HD': 1, 'Chirp HD': 2, 'Neural2': 3, 'Studio': 4, 'WaveNet': 5, 'Standard': 6 }
    
    return languageFilteredVoices.sort((a, b) => {
      if (typePriority[a.type] !== typePriority[b.type]) {
        return typePriority[a.type] - typePriority[b.type]
      }
      return a.name.localeCompare(b.name)
    })
  }

  createVoiceSelectorModal(voices) {
    const modal = document.createElement('div')
    modal.className = 'tts-voice-modal'
    modal.innerHTML = `
      <div class="tts-voice-modal-content">
        <div class="tts-voice-modal-header">
          <div>
            <h3>Select Google TTS Voice</h3>
            <div class="tts-voice-info">Chirp voices optimized for conversations • ${voices.length} voices available</div>
          </div>
          <button class="tts-voice-modal-close">&times;</button>
        </div>
        <div class="tts-voice-modal-body">
          <div class="tts-speed-control">
            <label>Speech Speed: <span id="speed-value">${this.selectedSpeed}</span></label>
            <input type="range" id="speed-slider" min="0.5" max="2.0" step="0.1" value="${this.selectedSpeed}">
          </div>
          <div class="tts-voice-list">
            ${voices.map(voice => `
              <div class="tts-voice-item ${voice.name === this.selectedVoice ? 'selected' : ''}" data-voice-name="${voice.name}">
                <div class="tts-voice-info">
                  <div class="tts-voice-name">
                    ${voice.name}
                    ${this.getVoiceTypeBadge(voice.type)}
                  </div>
                  <div class="tts-voice-details">
                    ${voice.lang} • ${voice.gender}
                    ${this.getVoiceDescription(voice.type)}
                  </div>
                </div>
                <button class="tts-voice-preview" data-voice-name="${voice.name}">
                  Preview
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `

    this.addVoiceSelectorStyles()
    this.setupVoiceSelectorEvents(modal, voices)
    return modal
  }

  getVoiceTypeBadge(type) {
    const badges = {
      'Chirp3 HD': '<span class="voice-type-badge chirp3-hd">✨ Chirp3 HD</span>',
      'Chirp HD': '<span class="voice-type-badge chirp-hd">🎭 Chirp HD</span>',
      'Neural2': '<span class="voice-type-badge neural2">🧠 Neural2</span>',
      'Studio': '<span class="voice-type-badge studio">🎙️ Studio</span>',
      'WaveNet': '<span class="voice-type-badge wavenet">🌊 WaveNet</span>',
      'Standard': '<span class="voice-type-badge standard">📢 Standard</span>'
    }
    return badges[type] || ''
  }

  getVoiceDescription(type) {
    const descriptions = {
      'Chirp3 HD': ' • Latest AI for natural conversations',
      'Chirp HD': ' • LLM-optimized for chat applications',
      'Neural2': ' • High-quality general purpose',
      'Studio': ' • Professional media voiceover',
      'WaveNet': ' • Premium quality synthesis',
      'Standard': ' • Basic text-to-speech'
    }
    return descriptions[type] || ''
  }

  addVoiceSelectorStyles() {
    if (document.getElementById('tts-voice-styles')) return

    const styles = document.createElement('style')
    styles.id = 'tts-voice-styles'
    styles.textContent = `
      .tts-voice-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center;
        z-index: 10000; opacity: 0; transition: opacity 0.3s ease; backdrop-filter: blur(4px);
      }
      .tts-voice-modal.show { opacity: 1; }
      .tts-voice-modal-content {
        background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px; width: 90%; max-width: 500px; max-height: 80vh; color: white;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      }
      .tts-voice-modal-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .tts-voice-modal-header h3 {
        margin: 0; color: rgba(255, 255, 255, 0.95); font-size: 18px; font-weight: 600;
      }
      .tts-voice-info {
        font-size: 13px; color: rgba(255, 255, 255, 0.6); margin-top: 4px;
      }
      .tts-voice-modal-close {
        background: none; border: none; color: rgba(255, 255, 255, 0.5);
        font-size: 24px; cursor: pointer; padding: 4px; width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center; border-radius: 6px;
        transition: all 0.2s ease;
      }
      .tts-voice-modal-close:hover {
        color: rgba(255, 255, 255, 0.9); background: rgba(255, 255, 255, 0.1);
      }
      .tts-voice-modal-body {
        padding: 20px; overflow-y: auto; max-height: 60vh;
      }
      .tts-speed-control {
        margin-bottom: 20px; padding: 16px; background: rgba(255, 255, 255, 0.05);
        border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .tts-speed-control label {
        display: block; margin-bottom: 8px; font-size: 14px; color: rgba(255, 255, 255, 0.9);
      }
      .tts-speed-control input[type="range"] {
        width: 100%; height: 6px; background: rgba(255, 255, 255, 0.2);
        border-radius: 3px; outline: none; appearance: none;
      }
      .tts-voice-list {
        display: flex; flex-direction: column; gap: 8px;
      }
      .tts-voice-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 16px; background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;
        cursor: pointer; transition: all 0.2s ease;
      }
      .tts-voice-item:hover {
        background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2);
      }
      .tts-voice-item.selected {
        background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.4);
      }
      .tts-voice-name {
        font-weight: 500; margin-bottom: 4px; color: rgba(255, 255, 255, 0.9);
        display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
      }
      .tts-voice-details {
        font-size: 12px; color: rgba(255, 255, 255, 0.5);
      }
      .tts-voice-preview {
        background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4);
        color: rgba(99, 102, 241, 1); padding: 8px 14px; border-radius: 6px;
        cursor: pointer; font-size: 12px; transition: all 0.2s ease;
      }
      .tts-voice-preview:hover {
        background: rgba(99, 102, 241, 0.3); border-color: rgba(99, 102, 241, 0.6);
      }
      .voice-type-badge {
        display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 4px;
        font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .voice-type-badge.chirp3-hd {
        background: linear-gradient(45deg, #8b5cf6, #a855f7); color: white;
        box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
      }
      .voice-type-badge.chirp-hd {
        background: linear-gradient(45deg, #06b6d4, #0891b2); color: white;
        box-shadow: 0 2px 4px rgba(6, 182, 212, 0.3);
      }
      .voice-type-badge.neural2 {
        background: linear-gradient(45deg, #10b981, #059669); color: white;
        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
      }
      .voice-type-badge.studio {
        background: linear-gradient(45deg, #f59e0b, #d97706); color: white;
        box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
      }
      .voice-type-badge.wavenet {
        background: linear-gradient(45deg, #3b82f6, #2563eb); color: white;
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
      }
      .voice-type-badge.standard {
        background: linear-gradient(45deg, #6b7280, #4b5563); color: white;
        box-shadow: 0 2px 4px rgba(107, 114, 128, 0.3);
      }
    `
    document.head.appendChild(styles)
  }

  setupVoiceSelectorEvents(modal, voices) {
    // Close modal
    modal.querySelector('.tts-voice-modal-close').onclick = () => {
      this.closeVoiceSelector(modal)
    }

    modal.onclick = (e) => {
      if (e.target === modal) this.closeVoiceSelector(modal)
    }

    // Speed control
    const speedSlider = modal.querySelector('#speed-slider')
    const speedValue = modal.querySelector('#speed-value')
    
    speedSlider.oninput = (e) => {
      const speed = parseFloat(e.target.value)
      speedValue.textContent = speed
      this.selectedSpeed = speed
      localStorage.setItem('googleTTSSpeed', speed.toString())
    }

    // Voice selection
    modal.querySelectorAll('.tts-voice-item').forEach(item => {
      item.onclick = (e) => {
        if (e.target.classList.contains('tts-voice-preview')) return
        
        const voiceName = item.dataset.voiceName
        this.selectVoice(voiceName)
        
        // Update UI
        modal.querySelectorAll('.tts-voice-item').forEach(i => i.classList.remove('selected'))
        item.classList.add('selected')
      }
    })

    // Voice preview
    modal.querySelectorAll('.tts-voice-preview').forEach(button => {
      button.onclick = async (e) => {
        e.stopPropagation()
        const voiceName = button.dataset.voiceName
        await this.previewVoice(voiceName, button)
      }
    })
  }

  selectVoice(voiceName) {
    this.selectedVoice = voiceName
    localStorage.setItem('googleTTSVoice', voiceName)
  }

  async previewVoice(voiceName, button) {
    button.disabled = true
    button.textContent = 'Loading...'
    
    try {
      // Use a clean sample text for preview
      const sampleText = this.cleanTextForTTS('Bonjour et bienvenue sous les étoiles ✨ Voici un exemple de voix 🌟')
      const audioUrl = await this.fetchGoogleTTS(sampleText, voiceName, this.selectedSpeed)
      
      button.textContent = 'Playing...'
      await this.playAudio(audioUrl)
      
      // Cleanup
      URL.revokeObjectURL(audioUrl)
      
    } catch (error) {
      console.error('Voice preview failed:', error)
    } finally {
      button.disabled = false
      button.textContent = 'Preview'
    }
  }

  closeVoiceSelector(modal) {
    modal.classList.remove('show')
    setTimeout(() => {
      document.body.removeChild(modal)
    }, 300)
  }

  // ===== CLEANUP =====

  cleanup() {
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause()
    }
    
    this.stopHealthMonitor()
    
    this.pendingTexts = []
    
    if (this.gestureHandler && this.gestureEvents) {
      this.gestureEvents.forEach(event => {
        document.removeEventListener(event, this.gestureHandler, { capture: true })
      })
      this.gestureHandler = null
      this.gestureEvents = null
    }
    
    if (window.TTSEventListenersAdded) {
      window.removeEventListener('tts:toggle', window.TTSToggleHandler)
      window.removeEventListener('tts:add', window.TTSAddHandler)
      window.removeEventListener('tts:stop', window.TTSStopHandler)
      window.removeEventListener('beforeunload', window.TTSBeforeUnloadHandler)
      window.removeEventListener('tts:enabled', window.TTSEnabledHandler)
      window.removeEventListener('keydown', window.TTSKeydownHandler)
      
      window.TTSEventListenersAdded = false
      window.TTSEventListenerCount = Math.max(0, (window.TTSEventListenerCount || 1) - 1)
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
  }

  // ===== AUDIO CONTEXT & IOS SETUP =====

  async initializeAudioContext() {
    try {
      // Create AudioContext for iOS compatibility
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      
      if (this.audioContext.state === 'suspended') {
        // Will be resumed on first user interaction
        this.setupUserGestureListener()
    } else {
        this.isIOSUnlocked = true
      }
    } catch (error) {
      console.warn('AudioContext initialization failed:', error)
      // Fallback to HTML5 audio
      this.audioContext = null
    }
  }

  setupUserGestureListener() {
    const gestureEvents = ['touchstart', 'touchend', 'click', 'keydown']
    const gestureHandler = async () => {
      if (!this.hasUserGesture) {
        await this.unlockAudio()
        this.hasUserGesture = true
        
        // Remove listeners after first gesture
        gestureEvents.forEach(event => {
          document.removeEventListener(event, gestureHandler, { capture: true })
        })
        
        // Process pending texts
        this.processPendingTexts()
      }
    }
    
    gestureEvents.forEach(event => {
      document.addEventListener(event, gestureHandler, { 
        passive: true, 
        capture: true 
      })
    })
  }

  async unlockAudio() {
    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
        this.isIOSUnlocked = true
        console.log('AudioContext unlocked for iOS')
      }
      
      // Test HTML5 audio as well
      const testAudio = new Audio()
      testAudio.volume = 0.1
      testAudio.muted = true
      await testAudio.play().catch(() => {})
      testAudio.pause()
      
      this.isIOSUnlocked = true
    } catch (error) {
      console.warn('Audio unlock failed:', error)
    }
  }

  setupIOSAudioUnlock() {
    if (!this.isIOS()) return
    this.setupUserGestureListener()
  }

  isIOS() {
    const userAgent = navigator.userAgent.toLowerCase()
    return /ipad|iphone|ipod/.test(userAgent) || 
           (userAgent.includes('mac') && 'ontouchend' in document)
  }

  // ===== RECOVERY MECHANISMS =====

  setupSpeechHealthMonitor() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval)
    }
    
    this.healthMonitorInterval = setInterval(() => {
      this.checkSpeechHealth()
    }, 2000)
  }

  checkSpeechHealth() {
    if (!this.processing || this.userStopped || !this.enabled) {
      return
    }

    if (this.isPlaying && !speechSynthesis.speaking && !speechSynthesis.pending) {
      console.warn('Speech synthesis appears stuck - no active speech detected')
      this.handleUnexpectedStop()
    }

    if (this.isPlaying && speechSynthesis.paused && !this.userStopped) {
      console.warn('Speech synthesis unexpectedly paused - resuming')
      speechSynthesis.resume()
    }

    if (this.processing && this.queue.length > 0 && !this.isPlaying && !speechSynthesis.speaking) {
      console.warn('Queue has items but speech is not active - restarting processing')
      setTimeout(() => {
        if (this.shouldContinueSpeaking()) {
          this.processQueue()
        }
      }, 500)
    }
  }

  stopHealthMonitor() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval)
      this.healthMonitorInterval = null
    }
  }

  // ===== VOICE RECORDER INTEGRATION =====

  wouldVoiceRecordingConflict() {
    return this.processing || 
           this.isPlaying || 
           this.queue.length > 0 || 
           speechSynthesis.speaking || 
           speechSynthesis.pending
  }

  safeStartVoiceRecording() {
    if (this.wouldVoiceRecordingConflict()) {
      console.warn('Cannot start voice recording - TTS is active')
      return false
    }
    
    const voiceToggleBtn = document.getElementById('voice-toggle-btn')
    if (voiceToggleBtn && !voiceToggleBtn.disabled) {
      console.log('Starting voice recording (TTS is idle)')
      
      window.__ttsProtected = true
      
      voiceToggleBtn.click()
      
      setTimeout(() => {
        window.__ttsProtected = false
      }, 1000)
      
      return true
    }
    
    return false
  }
} 