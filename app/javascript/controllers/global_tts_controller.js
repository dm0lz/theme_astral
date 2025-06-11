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
    
    // Handle button visibility based on TTS enabled state
    if (enabled) {
      // Show button - remove hidden class and ensure visibility
      button.classList.remove('hidden')
      button.style.display = 'inline-flex'
      button.style.opacity = '1'
      button.style.visibility = 'visible'
    } else {
      // Hide button - use inline styles to override any existing styles
      button.classList.add('hidden')
      button.style.display = 'none'
      button.style.opacity = '0'
      button.style.visibility = 'hidden'
      return // Don't set button state if TTS is disabled
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
      if (window.__ttsEnabled) {
        // Show button - remove hidden class and ensure visibility
        button.classList.remove('hidden')
        button.style.display = 'inline-flex' // Restore display
        button.style.opacity = '1'
        button.style.visibility = 'visible'
      } else {
        // Hide button - use inline styles to override any existing styles
        button.classList.add('hidden')
        button.style.display = 'none'
        button.style.opacity = '0'
        button.style.visibility = 'hidden'
        return // Don't update button state if TTS is disabled
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
    
    // Only make visible if TTS is enabled
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
    
    // Only make visible if TTS is enabled
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
 * Global TTS Controller
 * Manages speech synthesis queue and audio playback using Speech Synthesis API
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
    this.createVoiceSelectorButton()
    
    // iOS compatibility: ensure all existing TTS buttons are visible
    setTimeout(() => {
      this.ensureAllButtonsVisible()
    }, 100)
    
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
    
    // Remove voice selector button
    const voiceButton = document.getElementById('tts-voice-selector-btn')
    if (voiceButton) {
      voiceButton.remove()
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
    
    // User interaction flags
    this.userStopped = false
    this.userInitiated = false
    
    // Simplified duplicate prevention - only very recent duplicates
    this.veryRecentTexts = new Map() // Track very recent texts (last 100ms)
    
    // Audio-level deduplication
    this.currentlyPlayingKey = null
    
    // Frontend request queue to prevent concurrent API calls
    this.requestQueue = []
    this.processingRequest = false
    
    // Autoplay detection and handling
    this.autoplayBlocked = false
    this.hasUserGesture = false
    this.voicesReady = false
    this.retryAttempts = new Map() // Track retry attempts per text
    
    // Initialize autoplay detection
    this.detectAutoplayCapability()
    this.initializeVoiceReadiness()
  }

  setupEventListeners() {
    // Remove any existing listeners first to prevent duplicates
    if (window.TTSEventListenersAdded) {
      window.removeEventListener('tts:toggle', window.TTSToggleHandler)
      window.removeEventListener('tts:add', window.TTSAddHandler) 
      window.removeEventListener('tts:stop', window.TTSStopHandler)
      window.removeEventListener('beforeunload', window.TTSBeforeUnloadHandler)
      window.removeEventListener('tts:enabled', window.TTSEnabledHandler)
      window.removeEventListener('keydown', window.TTSKeydownHandler)
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
    
    // Mark that event listeners have been added
    window.TTSEventListenersAdded = true
    window.TTSEventListenerCount = (window.TTSEventListenerCount || 0) + 1
    
    // Expose voice selector globally
    window.showTTSVoiceSelector = () => this.showVoiceSelector()
    
    // Set up user gesture detection for autoplay
    this.setupUserGestureDetection()
  }

  setupUserGestureDetection() {
    // Track user interactions to enable autoplay
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
    
    // Store reference for cleanup
    this.gestureHandler = gestureHandler
    this.gestureEvents = gestureEvents
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
      // For Speech Synthesis, we don't actually prefetch audio blobs
      // but we can prepare the utterance
      this.prefetched.set(key, text)
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
    
    // Enhanced iOS check - be more aggressive about preventing requests
    if (this.isIOS()) {
      if (!window.__audioUnlocked) {
        // Queue the text for later without showing prompt
        this.pendingIOSTexts = this.pendingIOSTexts || []
        this.pendingIOSTexts.push({ text, messageId })
        return
      }
    }
    
    // Check if autoplay is blocked and we don't have user gesture
    if (this.autoplayBlocked && !this.hasUserGesture) {
      console.warn('TTS autoplay blocked - waiting for user gesture')
      // Queue for later when user interacts
      this.pendingIOSTexts = this.pendingIOSTexts || []
      this.pendingIOSTexts.push({ text, messageId })
      return
    }
    
    // Wait for voices to be ready
    if (!this.voicesReady) {
      console.warn('TTS voices not ready - queuing text')
      setTimeout(() => this.enqueue(text, messageId), 500)
      return
    }
    
    const key = this.normalizeText(text)
    
    // Simplified duplicate prevention - only check if currently in queue or already spoken
    if (this.isAlreadyProcessed(key)) {
      return
    }
    
    // Only prevent very rapid duplicates (same content within 100ms)
    if (this.isVeryRecentDuplicate(key)) {
      return
    }
    
    this.markAsVeryRecent(key)
    this.prefetchText(text)
    this.queue.push({ text, key, messageId, retryCount: 0 })
    
    if (!this.processing) {
      this.startProcessing(messageId)
    }
    
    this.processQueue()
  }

  isAlreadyProcessed(key) {
    return this.spoken.has(key) || this.queue.some(item => item.key === key)
  }
  
  isVeryRecentDuplicate(key) {
    if (!this.veryRecentTexts.has(key)) return false
    
    const lastTimestamp = this.veryRecentTexts.get(key)
    const now = Date.now()
    
    // Only prevent duplicates within 100ms (very rapid)
    return (now - lastTimestamp) < 100
  }
  
  markAsVeryRecent(key) {
    const now = Date.now()
    this.veryRecentTexts.set(key, now)
    
    // Clean up old entries more frequently
    for (const [textKey, timestamp] of this.veryRecentTexts.entries()) {
      if (now - timestamp > 500) { // Clean up after 500ms
        this.veryRecentTexts.delete(textKey)
      }
    }
  }

  startProcessing(messageId) {
    // Only stop current session if explicitly different message AND user didn't manually start
    if (this.processing && this.currentMessageId !== messageId && !this.userInitiated) {
      this.stop()
    }
    
    this.processing = true
    this.currentMessageId = messageId
    this.userInitiated = false // Reset flag
    window.GlobalTTSManager.setActiveMessage(messageId)
    
    // Start health monitoring to ensure speech continues
    this.setupSpeechHealthMonitor()
    
    console.log(`Started TTS processing for message: ${messageId}`)
  }

  async processQueue() {
    // Continue processing even if currently playing (queue up next items)
    if (this.queue.length === 0) {
      if (this.processing && !this.playing) {
        this.endProcessing()
      }
      return
    }
    
    // If already playing, wait and retry
    if (this.playing) {
      setTimeout(() => this.processQueue(), 50)
      return
    }
    
    // Don't process if user stopped or TTS is disabled
    if (!this.shouldContinueSpeaking()) {
      console.log('Stopping queue processing - user stopped or TTS disabled')
      return
    }
    
    const queueItem = this.queue.shift()
    const { text, key, messageId, retryCount } = queueItem
    
    console.log(`Processing TTS queue item: "${text.substring(0, 100)}..." (retry: ${retryCount})`)
    
    try {
      this.playing = true
      await this.playAudio(text, key)
      this.spoken.add(key)
      
      // Clear retry attempts on success
      this.retryAttempts.delete(key)
      
      console.log('TTS queue item completed successfully')
      
    } catch (error) {
      // Handle different types of errors
      const shouldRetry = this.shouldRetryPlayback(error, retryCount)
      
      if (shouldRetry && retryCount < 3) {
        console.warn(`TTS playback failed, retrying (${retryCount + 1}/3):`, error.message)
        
        // Add back to queue with incremented retry count
        queueItem.retryCount = retryCount + 1
        this.queue.unshift(queueItem) // Add to front for immediate retry
        
        // Wait before retry (progressive backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        
      } else {
        // Max retries reached or non-retryable error
        console.error('TTS playback failed permanently:', error.message)
        this.handlePlaybackFailure(text, messageId, error)
        
        // Don't stop the entire queue for one failed item
        // Mark as spoken to continue with next items
        this.spoken.add(key)
      }
    } finally {
      this.playing = false
      
      // Ensure we continue processing even after errors
      // Small delay to prevent tight loops
      setTimeout(() => {
        if (this.shouldContinueSpeaking()) {
          this.processQueue()
        }
      }, 100)
    }
  }

  shouldRetryPlayback(error, retryCount) {
    // Don't retry user-initiated stops
    if (error.message.includes('interrupted') || error.message.includes('cancelled')) {
      return false
    }
    
    // Don't retry if user explicitly stopped
    if (this.userStopped) {
      return false
    }
    
    // Retry on autoplay blocks, voice loading issues, or temporary failures
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
    // Mark this content as spoken to prevent infinite retries
    const key = this.normalizeText(text)
    this.spoken.add(key)
    
    // If it's an autoplay issue, try to prompt for user gesture
    if (error.message.toLowerCase().includes('autoplay') || 
        error.message.toLowerCase().includes('gesture')) {
      this.promptForUserGesture()
    }
    
    // Reset button state
    const btn = window.GlobalTTSManager.getButtonByMessageId(messageId)
    if (btn) {
      window.GlobalTTSManager.setSpeakerState(btn)
    }
  }

  promptForUserGesture() {
    // Only prompt once
    if (this.hasPromptedForGesture) return
    this.hasPromptedForGesture = true
    
    // Show a subtle notification that user interaction is needed
    console.info('TTS requires user interaction - click anywhere to enable autoplay')
    
    // Set up one-time listeners for user gesture
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
    
    // Stop health monitoring
    this.stopHealthMonitor()
    
    console.log('TTS processing completed')
    
    // Enable hands-free chat: auto-start voice recording when TTS finishes
    this.enableHandsFreeChat()
  }

  enableHandsFreeChat() {
    // Only enable hands-free chat if:
    // 1. TTS is enabled
    // 2. We're on the chat messages page (has #chat_messages element)
    // 3. Voice toggle button exists and isn't disabled
    if (!window.__ttsEnabled) return
    
    const chatMessagesContainer = document.getElementById('chat_messages')
    if (!chatMessagesContainer) return // Not on chat page
    
    const voiceToggleBtn = document.getElementById('voice-toggle-btn')
    if (!voiceToggleBtn || voiceToggleBtn.disabled) return // Button not available or disabled
    
    const recorder = window.voiceRecorderInstance
    if (!recorder || recorder.isRecording) return // No recorder or already recording
    
    // Add a small delay to ensure TTS has fully completed
    setTimeout(() => {
      // Double-check conditions haven't changed
      if (window.__ttsEnabled && !recorder.isRecording && !voiceToggleBtn.disabled) {
        // Simulate click on voice toggle button to start recording
        voiceToggleBtn.click()
      }
    }, 500) // 500ms delay to ensure smooth transition
  }

  // ===== AUDIO PLAYBACK =====

  splitTextIntoChunks(text, maxLength = 200) {
    // Clean emojis and icons from text before processing
    let cleanedText = text.replace(/[\u{1F600}-\u{1F64F}\u{2728}\u{1F319}\u{1F52E}]/gu, '')
    
    // Split text into sentences, including those that don't end with punctuation
    const sentences = []
    
    // First, split by sentence-ending punctuation
    const parts = cleanedText.split(/([.!?]+)/)
    let currentSentence = ''
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      if (!part) continue
      
      if (/^[.!?]+$/.test(part)) {
        // This is punctuation, add it to current sentence
        currentSentence += part
        if (currentSentence.trim()) {
          sentences.push(currentSentence.trim())
        }
        currentSentence = ''
      } else {
        // This is text content
        currentSentence += part
        
        // If this is the last part and we have content, it's the final sentence
        if (i === parts.length - 1 && currentSentence.trim()) {
          sentences.push(currentSentence.trim())
        }
      }
    }
    
    // If we didn't find any sentences with the split method, treat entire text as one sentence
    if (sentences.length === 0 && cleanedText.trim()) {
      sentences.push(cleanedText.trim())
    }
    
    // Now chunk the sentences
    const chunks = []
    let currentChunk = ''

    for (const sentence of sentences) {
      if (!sentence) continue

      // If adding this sentence would exceed maxLength, save current chunk and start new one
      if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence
      }
    }

    // Add the last chunk if it's not empty
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }

    return chunks.length > 0 ? chunks : [cleanedText.trim()]
  }

  async speakChunk(chunk, voice, chunkIndex, totalChunks) {
    return new Promise((resolve, reject) => {
      // Don't start if user explicitly stopped
      if (this.userStopped || !this.processing) {
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(chunk)
      const browserLang = navigator.language || navigator.userLanguage
      utterance.lang = browserLang
      
      // Configure voice settings for better reliability
      utterance.rate = 1.0
      utterance.pitch = 1.2
      utterance.volume = 1.0
      
      if (voice) {
        utterance.voice = voice
      }

      // Track if this utterance has started
      let hasStarted = false
      let hasEnded = false
      let timeoutId = null

      // Set up a safety timeout to prevent hanging
      const setupSafetyTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId)
        
        // Calculate reasonable timeout based on chunk length
        const wordsPerMinute = 150 // Average speaking rate
        const words = chunk.split(' ').length
        const estimatedDuration = (words / wordsPerMinute) * 60 * 1000
        const safetyMargin = Math.max(5000, estimatedDuration * 2) // At least 5s, or 2x estimated
        
        timeoutId = setTimeout(() => {
          if (!hasEnded && hasStarted) {
            console.warn('Speech chunk timed out, continuing to next chunk')
            if (!hasEnded) {
              hasEnded = true
              resolve()
            }
          }
        }, safetyMargin)
      }

      utterance.onstart = () => {
        hasStarted = true
        setupSafetyTimeout() // Start timeout only after speech begins
        
        // Ensure speech synthesis isn't paused
        if (speechSynthesis.paused) {
          speechSynthesis.resume()
        }
      }

      utterance.onend = () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (!hasEnded) {
          hasEnded = true
          resolve()
        }
      }
      
      utterance.onerror = (event) => {
        if (timeoutId) clearTimeout(timeoutId)
        
        if (hasEnded) return // Already handled
        hasEnded = true
        
        // Handle different error types
        if (event.error === 'interrupted') {
          // Check if user actually stopped or if it's an automatic interruption
          if (this.userStopped) {
            resolve() // User intentionally stopped
          } else {
            console.warn('Speech interrupted unexpectedly, continuing...')
            resolve() // Continue to next chunk
          }
        } else if (event.error === 'canceled') {
          resolve() // Treat as completed
        } else {
          console.error(`Speech synthesis error: ${event.error}`)
          reject(new Error(`Speech synthesis failed: ${event.error}`))
        }
      }

      utterance.onpause = () => {
        // Auto-resume if paused (unless user stopped)
        if (!this.userStopped && this.processing) {
          setTimeout(() => {
            if (speechSynthesis.paused && !this.userStopped) {
              speechSynthesis.resume()
            }
          }, 100)
        }
      }

      // Start speaking
      try {
        speechSynthesis.speak(utterance)
        
        // Fallback timeout in case onstart never fires
        setTimeout(() => {
          if (!hasStarted && !hasEnded && !this.userStopped) {
            console.warn('Speech failed to start, skipping chunk')
            if (!hasEnded) {
              hasEnded = true
              resolve()
            }
          }
        }, 3000)
        
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId)
        if (!hasEnded) {
          hasEnded = true
          reject(new Error(`Failed to start speech: ${error.message}`))
        }
      }
    })
  }

  async getAvailableVoices() {
    return new Promise((resolve) => {
      let voices = speechSynthesis.getVoices()
      
      if (voices.length > 0) {
        resolve(voices)
        return
      }
      
      // Voices not ready yet, wait for them
      const handleVoicesChanged = () => {
        voices = speechSynthesis.getVoices()
        if (voices.length > 0) {
          speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
          resolve(voices)
        }
      }
      
      speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
      
      // Fallback timeout in case voiceschanged never fires
      setTimeout(() => {
        speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
        resolve(speechSynthesis.getVoices()) // Return whatever we have
      }, 1000)
    })
  }

  async selectBestVoice() {
    let voices = await this.getAvailableVoices()
    
    if (voices.length === 0) {
      return null
    }
    
    // First priority: Check for stored voice preference
    const selectedVoiceName = this.getSelectedVoiceName()
    if (selectedVoiceName) {
      const storedVoice = voices.find(voice => voice.name === selectedVoiceName)
      if (storedVoice) {
        return storedVoice
    } else {
        // Clear invalid stored voice
        localStorage.removeItem('ttsSelectedVoice')
      }
    }
    
    // Get browser language and country
    const browserLang = navigator.language || navigator.userLanguage
    const browserCountry = browserLang.split('-')[1]?.toUpperCase()
    
    // Filter voices by browser country if available
    const countryVoices = browserCountry ? 
      voices.filter(voice => {
        const voiceCountry = voice.lang.split('-')[1]?.toUpperCase()
        return voiceCountry === browserCountry
      }) : []
      
    if (countryVoices.length > 0) {
      voices = countryVoices
    }

    // select siri voice specifically from country voices
    const siriVoice = countryVoices.find(voice => 
      voice.name.toLowerCase().includes("siri")
    )
    if (siriVoice) {
    }
    
    // Check for google voice specifically
    const googleVoice = voices.find(voice => 
      voice.name.toLowerCase().includes("google")
    )
    if (googleVoice) {
    } else {
    }
    
    // Prefer siri voice FIRST, then google voice, then language-based fallbacks
    const preferredVoice = siriVoice || googleVoice || voices.find(voice => 
      voice.lang.startsWith('en') ||
      voice.lang.startsWith('fr') ||
      voice.default
    ) || voices[0]
    
    return preferredVoice
  }

  async playAudio(text, key) {
    // Only check for same content if it's actually currently playing
    if (this.currentlyPlayingKey === key && this.playing) {
      return
    }
    
    // Mark this audio as currently playing
    this.currentlyPlayingKey = key
    window.CurrentlyPlayingTTSKey = key
    
    try {
      // Check browser support
      if (!('speechSynthesis' in window)) {
        throw new Error('Speech synthesis not supported in this browser')
      }

      // Ensure speech synthesis is ready and not stuck
      if (speechSynthesis.speaking) {
        // If something else is speaking, cancel it first
        speechSynthesis.cancel()
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Check if speechSynthesis is paused and resume it
      if (speechSynthesis.paused) {
        speechSynthesis.resume()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // iOS-specific handling
      if (this.isIOS()) {
        if (!window.__audioUnlocked) {
          throw new Error('Audio not unlocked on iOS - user gesture required')
        }
      }

      // Check autoplay capability
      if (this.autoplayBlocked && !this.hasUserGesture) {
        throw new Error('Autoplay blocked - user gesture required')
      }

      // Ensure voices are ready
      if (!this.voicesReady) {
        console.warn('Voices not ready, waiting...')
        await this.waitForVoices()
      }

      // Select the best available voice
      const selectedVoice = await this.selectBestVoice()
      
      // Split text into manageable chunks
      const chunks = this.splitTextIntoChunks(text)

      // Update button to show it's starting
      const btn = window.GlobalTTSManager.getButtonByMessageId(this.currentMessageId)
      if (btn) {
        window.GlobalTTSManager.setStopState(btn)
      }

      // Set up monitoring to ensure speech continues
      const monitorSpeech = () => {
        // Check every 500ms if speech is still active when it should be
        if (this.processing && !this.userStopped) {
          if (speechSynthesis.paused) {
            console.warn('Speech unexpectedly paused, resuming...')
            speechSynthesis.resume()
          }
          
          // Continue monitoring
          setTimeout(monitorSpeech, 500)
        }
      }
      
      // Start monitoring
      setTimeout(monitorSpeech, 500)

      // Speak each chunk sequentially with robust continuation
      for (let i = 0; i < chunks.length; i++) {
        // Only check if user explicitly stopped
        if (this.userStopped) {
          console.log('User stopped speech, exiting chunks loop')
          break
        }
        
        // Double-check processing state
        if (!this.processing) {
          console.log('Processing stopped, exiting chunks loop')
          break
        }

        console.log(`Speaking chunk ${i + 1}/${chunks.length}: "${chunks[i].substring(0, 50)}..."`)
        
        try {
          await this.speakChunk(chunks[i], selectedVoice, i, chunks.length)
        } catch (chunkError) {
          console.warn(`Chunk ${i + 1} failed, continuing to next:`, chunkError.message)
          // Continue to next chunk instead of failing entirely
        }
        
        // Small delay between chunks to prevent issues, but check for stops
        if (i < chunks.length - 1 && !this.userStopped && this.processing) {
          await new Promise(resolve => setTimeout(resolve, 150))
        }
      }

      console.log('All chunks completed successfully')

    } catch (error) {
      // Enhance error information
      let enhancedError = error
      
      if (error.message.includes('synthesis') || error.name === 'SpeechSynthesisErrorEvent') {
        enhancedError = new Error(`Speech synthesis error: ${error.message}`)
      } else if (error.message.includes('network')) {
        enhancedError = new Error(`Network error during TTS: ${error.message}`)
      }
      
      // Don't log "interrupted" errors as they are expected when user stops speech
      if (!error.message.includes('interrupted') && !error.message.includes('cancelled')) {
        console.error('TTS playback error:', enhancedError.message)
      }
      
      throw enhancedError
    } finally {
      // Clear markers on completion
      this.currentlyPlayingKey = null
      window.CurrentlyPlayingTTSKey = null
    }
  }

  async waitForVoices(timeout = 3000) {
    return new Promise((resolve) => {
      if (this.voicesReady) {
        resolve()
        return
      }
      
      const checkVoices = () => {
        const voices = speechSynthesis.getVoices()
        if (voices.length > 0) {
          this.voicesReady = true
          resolve()
        }
      }
      
      // Check immediately
      checkVoices()
      
      // Set up listener
      speechSynthesis.addEventListener('voiceschanged', checkVoices)
      
      // Timeout fallback
      setTimeout(() => {
        speechSynthesis.removeEventListener('voiceschanged', checkVoices)
        this.voicesReady = true
        resolve()
      }, timeout)
    })
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

  getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ''
  }

  // ===== CONTROLS =====

  stop() {
    // Mark as user-initiated stop
    this.userStopped = true
    
    console.log('TTS stop requested by user')
    
    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    
    // Legacy audio cleanup (if any)
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
    
    // Reset user stop flag after a brief delay to allow for cleanup
    setTimeout(() => {
      this.userStopped = false
      console.log('TTS stop flag reset')
    }, 500) // Increased delay to ensure cleanup completes
  }

  // New method to check if speech should continue
  shouldContinueSpeaking() {
    return this.processing && 
           !this.userStopped && 
           this.enabled && 
           window.__ttsEnabled
  }

  // Method to handle unexpected speech interruptions
  handleUnexpectedStop() {
    // Only restart if it wasn't a user-initiated stop
    if (this.shouldContinueSpeaking() && this.queue.length > 0) {
      console.warn('Speech unexpectedly stopped, attempting to continue...')
      
      // Small delay before retrying
      setTimeout(() => {
        if (this.shouldContinueSpeaking()) {
          this.processQueue()
        }
      }, 1000)
    }
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
    
    // Stop health monitoring
    this.stopHealthMonitor()
    
    // Clear pending iOS texts
    this.pendingIOSTexts = []
    
    // Clean up gesture detection listeners
    if (this.gestureHandler && this.gestureEvents) {
      this.gestureEvents.forEach(event => {
        document.removeEventListener(event, this.gestureHandler, { capture: true })
      })
      this.gestureHandler = null
      this.gestureEvents = null
    }
    
    // Clean up event listeners
    if (window.TTSEventListenersAdded) {
      window.removeEventListener('tts:toggle', window.TTSToggleHandler)
      window.removeEventListener('tts:add', window.TTSAddHandler)
      window.removeEventListener('tts:stop', window.TTSStopHandler)
      window.removeEventListener('beforeunload', window.TTSBeforeUnloadHandler)
      window.removeEventListener('tts:enabled', window.TTSEnabledHandler)
      window.removeEventListener('keydown', window.TTSKeydownHandler)
      
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
    
    try {
      // Small delay to ensure "Enabling Audio..." is visible
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // For Speech Synthesis, we mainly need user gesture
      // Test if speechSynthesis works
      if ('speechSynthesis' in window) {
        // Try to speak a silent utterance to unlock
        const testUtterance = new SpeechSynthesisUtterance('')
        testUtterance.volume = 0
        speechSynthesis.speak(testUtterance)
        
        // Wait a moment for the test
        await new Promise(resolve => setTimeout(resolve, 100))
        
        window.__audioUnlocked = true
        
        // Mark that we have user gesture now
        this.markUserGesture()
        
        // Process pending texts immediately
        if (this.pendingIOSTexts && this.pendingIOSTexts.length > 0) {
          const pendingTexts = [...this.pendingIOSTexts] // Create copy
          this.pendingIOSTexts = []
          
          console.log(`Processing ${pendingTexts.length} pending TTS texts`)
          
          // Process each pending text with a small delay between them
          for (let i = 0; i < pendingTexts.length; i++) {
            const { text, messageId } = pendingTexts[i]
            
            // Add small delay to prevent overwhelming the system
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            
            this.enqueue(text, messageId)
          }
        }
        
        return true
      } else {
        return false
      }
    } catch (error) {
      // For Speech Synthesis, even errors can indicate unlock worked
      window.__audioUnlocked = true
      this.markUserGesture()
      return true
    }
  }

  isIOS() {
    // Enhanced iOS detection for better reliability
    const userAgent = navigator.userAgent.toLowerCase()
    const isIOSDevice = /ipad|iphone|ipod/.test(userAgent)
    const isMacWithTouch = userAgent.includes('mac') && 'ontouchend' in document
    const isIOSWebKit = /webkit/.test(userAgent) && /mobile/.test(userAgent)
    
    // Additional iOS indicators
    const hasIOSVendor = /apple/.test(navigator.vendor.toLowerCase())
    const isIOSSafari = /safari/.test(userAgent) && /mobile/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent)
    const isIOSChrome = /crios/.test(userAgent)
    const isIOSFirefox = /fxios/.test(userAgent)
    
    // Check for iOS-specific APIs
    const hasIOSAPIs = 'ontouchstart' in window && window.DeviceMotionEvent !== undefined
    
    const isIOS = isIOSDevice || isMacWithTouch || isIOSWebKit || hasIOSVendor || isIOSSafari || isIOSChrome || isIOSFirefox || hasIOSAPIs
    
    return isIOS
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

  // ===== VOICE SELECTION SYSTEM =====

  async showVoiceSelector() {
    const allVoices = await this.getAvailableVoices()
    if (allVoices.length === 0) {
      alert('No voices available')
      return
    }

    // Filter voices by browser language country
    const browserLang = navigator.language || navigator.userLanguage
    const browserCountry = browserLang.split('-')[1]?.toUpperCase()
    
    let voices = allVoices
    if (browserCountry) {
      const countryVoices = allVoices.filter(voice => {
        const voiceCountry = voice.lang.split('-')[1]?.toUpperCase()
        return voiceCountry === browserCountry
      })
      
      if (countryVoices.length > 0) {
        voices = countryVoices
      } else {
      }
    }

    // Create modal
    const modal = this.createVoiceSelectorModal(voices, browserCountry)
    document.body.appendChild(modal)
    
    // Show modal
    setTimeout(() => modal.classList.add('show'), 10)
  }

  createVoiceSelectorModal(voices, browserCountry) {
    const modal = document.createElement('div')
    modal.className = 'tts-voice-modal'
    modal.innerHTML = `
      <div class="tts-voice-modal-content">
        <div class="tts-voice-modal-header">
          <div>
            <h3>Select Voice</h3>
            <div class="tts-voice-country-info">${browserCountry ? `Showing ${voices.length} voices for ${browserCountry}` : `Showing all ${voices.length} voices`}</div>
          </div>
          <button class="tts-voice-modal-close">&times;</button>
        </div>
        <div class="tts-voice-modal-body">
          <div class="tts-voice-list">
            ${voices.map(voice => `
              <div class="tts-voice-item" data-voice-name="${voice.name}">
                <div class="tts-voice-info">
                  <div class="tts-voice-name">${voice.name}</div>
                  <div class="tts-voice-lang">${voice.lang}</div>
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

    // Add styles
    this.addVoiceSelectorStyles()

    // Add event listeners
    this.setupVoiceSelectorEvents(modal, voices)

    // Highlight current selection
    this.highlightCurrentVoice(modal)

    return modal
  }

  addVoiceSelectorStyles() {
    if (document.getElementById('tts-voice-styles')) return

    const styles = document.createElement('style')
    styles.id = 'tts-voice-styles'
    styles.textContent = `
      .tts-voice-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
        backdrop-filter: blur(4px);
      }
      .tts-voice-modal.show {
        opacity: 1;
      }
      .tts-voice-modal-content {
        background: rgba(17, 24, 39, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        color: white;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(20px);
      }
      .tts-voice-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .tts-voice-modal-header h3 {
        margin: 0;
        color: rgba(255, 255, 255, 0.95);
        font-size: 18px;
        font-weight: 600;
      }
      .tts-voice-country-info {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 4px;
      }
      .tts-voice-modal-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s ease;
      }
      .tts-voice-modal-close:hover {
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.1);
      }
      .tts-voice-modal-body {
        padding: 20px;
        overflow-y: auto;
        max-height: 60vh;
      }
      .tts-voice-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .tts-voice-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .tts-voice-item:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        transform: translateY(-1px);
      }
      .tts-voice-item.selected {
        background: rgba(34, 197, 94, 0.15);
        border-color: rgba(34, 197, 94, 0.4);
        box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.2);
      }
      .tts-voice-item.selected:hover {
        background: rgba(34, 197, 94, 0.2);
        border-color: rgba(34, 197, 94, 0.5);
      }
      .tts-voice-info {
        flex: 1;
        min-width: 0;
      }
      .tts-voice-name {
        font-weight: 500;
        margin-bottom: 4px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
      }
      .tts-voice-item.selected .tts-voice-name {
        color: rgba(34, 197, 94, 1);
      }
      .tts-voice-lang {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        font-family: monospace;
      }
      .tts-voice-item.selected .tts-voice-lang {
        color: rgba(34, 197, 94, 0.8);
      }
      .tts-voice-preview {
        background: rgba(99, 102, 241, 0.2);
        border: 1px solid rgba(99, 102, 241, 0.4);
        color: rgba(99, 102, 241, 1);
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
        margin-left: 12px;
        flex-shrink: 0;
      }
      .tts-voice-preview:hover {
        background: rgba(99, 102, 241, 0.3);
        border-color: rgba(99, 102, 241, 0.6);
        color: rgba(99, 102, 241, 1);
        transform: translateY(-1px);
      }
      .tts-voice-preview:active {
        transform: translateY(0);
        background: rgba(99, 102, 241, 0.4);
      }
      .tts-voice-preview:disabled {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.4);
        cursor: not-allowed;
        transform: none;
      }
    `
    document.head.appendChild(styles)
  }

  setupVoiceSelectorEvents(modal, voices) {
    // Close modal
    modal.querySelector('.tts-voice-modal-close').onclick = () => {
      this.closeVoiceSelector(modal)
    }

    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeVoiceSelector(modal)
      }
    }

    // Voice selection
    modal.querySelectorAll('.tts-voice-item').forEach(item => {
      item.onclick = (e) => {
        if (e.target.classList.contains('tts-voice-preview')) return
        
        const voiceName = item.dataset.voiceName
        this.selectVoice(voiceName)
        this.highlightCurrentVoice(modal)
      }
    })

    // Voice preview
    modal.querySelectorAll('.tts-voice-preview').forEach(button => {
      button.onclick = async (e) => {
        e.stopPropagation()
        const voiceName = button.dataset.voiceName
        const voice = voices.find(v => v.name === voiceName)
        await this.previewVoice(voice, button)
      }
    })
  }

  highlightCurrentVoice(modal) {
    const selectedVoiceName = this.getSelectedVoiceName()
    
    modal.querySelectorAll('.tts-voice-item').forEach(item => {
      item.classList.remove('selected')
      if (item.dataset.voiceName === selectedVoiceName) {
        item.classList.add('selected')
      }
    })
  }

  async previewVoice(voice, button) {
    // Stop any current speech
    speechSynthesis.cancel()
    
    // Disable button during preview
    button.disabled = true
    button.textContent = 'Playing...'
    
    try {
      const utterance = new SpeechSynthesisUtterance('bonjour et bienvenue sous les étoiles')
      utterance.voice = voice
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0
      
      utterance.onend = () => {
        button.disabled = false
        button.textContent = 'Preview'
      }
      
      utterance.onerror = () => {
        button.disabled = false
        button.textContent = 'Preview'
      }
      
      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error('Voice preview error:', error)
      button.disabled = false
      button.textContent = 'Preview'
    }
  }

  selectVoice(voiceName) {
    localStorage.setItem('ttsSelectedVoice', voiceName)
  }

  getSelectedVoiceName() {
    return localStorage.getItem('ttsSelectedVoice')
  }

  closeVoiceSelector(modal) {
    modal.classList.remove('show')
    setTimeout(() => {
      document.body.removeChild(modal)
    }, 300)
  }

  createVoiceSelectorButton() {
    // Only show voice selector button on chat messages index page
    const chatMessagesContainer = document.getElementById('chat_messages')
    if (!chatMessagesContainer) {
      return // Exit early if not on chat messages page
    }

    // Remove existing button if present
    const existingButton = document.getElementById('tts-voice-selector-btn')
    if (existingButton) {
      existingButton.remove()
    }

    // Define shared button classes for consistency
    const buttonClasses = 'inline-flex items-center justify-center gap-1.5 bg-transparent border border-white/20 text-white/70 px-3 py-2 rounded-md cursor-pointer text-sm font-normal transition-all duration-200 whitespace-nowrap min-h-8 relative z-10 flex-shrink-0 hover:bg-white/10 hover:border-white/30 hover:text-white/90 active:bg-white/15 active:scale-95 focus:outline-2 focus:outline-blue-500/50 focus:outline-offset-2'

    // Create voice selector button using Tailwind classes
    const button = document.createElement('button')
    button.id = 'tts-voice-selector-btn'
    button.className = buttonClasses + ' ml-2'
    button.innerHTML = `
      <svg class="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0 opacity-80 hover:opacity-100" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
      </svg>
      <span class="hidden sm:inline">Voice</span>
      <span class="sm:hidden">Voice</span>
    `
    button.title = 'Select TTS Voice (Ctrl+Shift+V)'
    
    // Ensure click event doesn't propagate
    button.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.showVoiceSelector()
    }

    // Find and style the clear button with the same design
    this.styleClearButton(buttonClasses)

    // Find a good place to insert the button
    const targetContainer = this.findVoiceButtonContainer()
    if (targetContainer) {
      // Look for a clear button to place next to
      const clearButton = this.findClearButton(targetContainer)
      
      if (clearButton) {
        // Insert right after the clear button
        clearButton.parentNode.insertBefore(button, clearButton.nextSibling)
      } else {
        // Add to the end of the container
        targetContainer.appendChild(button)
      }
    } else {
      // Fallback: add to body with fixed positioning
      button.classList.add('fixed', 'top-5', 'right-5', 'z-50')
      document.body.appendChild(button)
    }
  }

  findClearButton(container) {
    // Try multiple selectors to find the clear button
    const selectors = [
      '[data-action*="clear"]',
      '[data-controller*="clear"]', 
      'button[title*="clear" i]',
      'button[title*="Clear" i]',
      '.clear-chat',
      '.clear-button',
      '#clear-chat',
      '#clear-button'
    ]
    
    for (const selector of selectors) {
      const clearButton = container.querySelector(selector)
      if (clearButton) {
        return clearButton
      }
    }
    
    // Also check for buttons with "clear" text content
    const allButtons = container.querySelectorAll('button')
    for (const button of allButtons) {
      if (button.textContent && button.textContent.toLowerCase().includes('clear')) {
        return button
      }
    }
    
    return null
  }

  styleClearButton(buttonClasses) {
    // Find clear button globally and apply consistent styling
    const clearButton = this.findClearButtonGlobally()
    
    if (clearButton) {
      
      // Remove existing classes that might conflict
      clearButton.removeAttribute('class')
      
      // Apply the same classes as voice button
      clearButton.className = buttonClasses
      
      // Ensure the button content is properly structured
      if (!clearButton.querySelector('svg') && !clearButton.innerHTML.includes('<')) {
        // If it's just text, wrap it properly
        const originalText = clearButton.textContent.trim()
        clearButton.innerHTML = `<span class="font-normal text-sm">${originalText}</span>`
      }
      
    }
  }

  findClearButtonGlobally() {
    // Try to find clear button in the entire document
    const selectors = [
      '[data-action*="clear"]',
      '[data-controller*="clear"]', 
      'button[title*="clear" i]',
      'button[title*="Clear" i]',
      '.clear-chat',
      '.clear-button',
      '#clear-chat',
      '#clear-button'
    ]
    
    for (const selector of selectors) {
      const clearButton = document.querySelector(selector)
      if (clearButton) {
        return clearButton
      }
    }
    
    // Check all buttons for "clear" text
    const allButtons = document.querySelectorAll('button')
    for (const button of allButtons) {
      if (button.textContent && button.textContent.toLowerCase().includes('clear')) {
        return button
      }
    }
    
    return null
  }

  findVoiceButtonContainer() {
    // First priority: Look for clear chat button and place voice button next to it
    const clearChatSelectors = [
      '[data-action*="clear"]',
      '[data-controller*="clear"]', 
      'button[title*="clear" i]',
      'button[title*="Clear" i]',
      '.clear-chat',
      '.clear-button',
      '#clear-chat',
      '#clear-button'
    ]
    
    for (const selector of clearChatSelectors) {
      const clearButton = document.querySelector(selector)
      if (clearButton) {
        return clearButton.parentElement
      }
    }
    
    // Also check for buttons with "clear" text content manually
    const allButtons = document.querySelectorAll('button')
    for (const button of allButtons) {
      if (button.textContent && button.textContent.toLowerCase().includes('clear')) {
        return button.parentElement
      }
    }
    
    // Second priority: Look for button containers that might contain the clear button
    const buttonContainerSelectors = [
      '.chat-controls',
      '.chat-actions', 
      '.message-controls',
      '.toolbar-buttons',
      '.action-buttons',
      '.flex.items-center.space-x-2',
      '.flex.gap-2',
      '.flex.space-x-2'
    ]
    
    for (const selector of buttonContainerSelectors) {
      const container = document.querySelector(selector)
      if (container && container.querySelector('button')) {
        return container
      }
    }
    
    // Third priority: Try to find an appropriate container for the voice button
    const generalContainers = [
      '.chat-header',
      '.toolbar',
      '.controls',
      'header',
      '.header',
      'nav',
      '.nav'
    ]

    for (const selector of generalContainers) {
      const container = document.querySelector(selector)
      if (container) {
        return container
      }
    }

    return null
  }

  // ===== AUTOPLAY DETECTION =====

  async detectAutoplayCapability() {
    try {
      // Test if speechSynthesis is available
      if (!('speechSynthesis' in window)) {
        this.autoplayBlocked = true
        return
      }

      // Try a silent test utterance to check autoplay capability
      const testUtterance = new SpeechSynthesisUtterance('')
      testUtterance.volume = 0
      testUtterance.rate = 10 // Very fast to minimize delay
      
      const testPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.autoplayBlocked = true
          resolve(false)
        }, 1000)
        
        testUtterance.onstart = () => {
          clearTimeout(timeout)
          this.autoplayBlocked = false
          resolve(true)
        }
        
        testUtterance.onerror = () => {
          clearTimeout(timeout)
          this.autoplayBlocked = true
          resolve(false)
        }
        
        testUtterance.onend = () => {
          clearTimeout(timeout)
          resolve(true)
        }
      })
      
      speechSynthesis.speak(testUtterance)
      await testPromise
      
    } catch (error) {
      console.warn('Autoplay detection failed:', error.message)
      this.autoplayBlocked = true
    }
  }

  async initializeVoiceReadiness() {
    try {
      const voices = await this.getAvailableVoices()
      this.voicesReady = voices.length > 0
      
      if (!this.voicesReady) {
        // Set up a listener for when voices become available
        const checkVoices = () => {
          const currentVoices = speechSynthesis.getVoices()
          if (currentVoices.length > 0) {
            this.voicesReady = true
            speechSynthesis.removeEventListener('voiceschanged', checkVoices)
          }
        }
        
        speechSynthesis.addEventListener('voiceschanged', checkVoices)
        
        // Fallback timeout
        setTimeout(() => {
          speechSynthesis.removeEventListener('voiceschanged', checkVoices)
          this.voicesReady = true // Assume ready after timeout
        }, 3000)
      }
    } catch (error) {
      console.warn('Voice readiness check failed:', error.message)
      this.voicesReady = true // Assume ready on error
    }
  }

  markUserGesture() {
    this.hasUserGesture = true
    this.autoplayBlocked = false
    
    // If we have pending iOS texts, process them now
    if (this.isIOS() && this.pendingIOSTexts && this.pendingIOSTexts.length > 0) {
      this.unlockIOSAudio()
    }
  }

  // ===== RECOVERY MECHANISMS =====

  // Monitor speech synthesis health and recover from stuck states
  setupSpeechHealthMonitor() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval)
    }
    
    this.healthMonitorInterval = setInterval(() => {
      this.checkSpeechHealth()
    }, 2000) // Check every 2 seconds
  }

  checkSpeechHealth() {
    // Only monitor when we should be speaking
    if (!this.processing || this.userStopped || !this.enabled) {
      return
    }

    // Check if speechSynthesis is in an unexpected state
    if (this.playing && !speechSynthesis.speaking && !speechSynthesis.pending) {
      console.warn('Speech synthesis appears stuck - no active speech detected')
      this.handleUnexpectedStop()
    }

    // Check if speech is paused when it shouldn't be
    if (this.playing && speechSynthesis.paused && !this.userStopped) {
      console.warn('Speech synthesis unexpectedly paused - resuming')
      speechSynthesis.resume()
    }

    // Check for queue backup when speech should be active
    if (this.processing && this.queue.length > 0 && !this.playing && !speechSynthesis.speaking) {
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
} 