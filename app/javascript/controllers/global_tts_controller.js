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
    
    // Frontend request queue to prevent concurrent API calls
    this.requestQueue = []
    this.processingRequest = false
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
      console.log('iOS detected, checking audio unlock status:', window.__audioUnlocked)
      
      if (!window.__audioUnlocked) {
        console.log('iOS audio not unlocked, queuing text for later')
        // Queue the text for later without showing prompt
        this.pendingIOSTexts = this.pendingIOSTexts || []
        this.pendingIOSTexts.push({ text, messageId })
        return
      }
      
      console.log('iOS audio appears unlocked, proceeding with TTS')
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
    
    console.log('TTS: Found sentences:', sentences)
    
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

    console.log('TTS: Created chunks:', chunks)
    return chunks.length > 0 ? chunks : [cleanedText.trim()]
  }

  async speakChunk(chunk, voice, chunkIndex, totalChunks) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      
      // Configure voice settings
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0
      
      if (voice) {
        utterance.voice = voice
      }

      utterance.onstart = () => {
        console.log(`TTS: Speaking chunk ${chunkIndex + 1}/${totalChunks}`)
      }

      utterance.onend = () => {
        console.log(`TTS: Finished chunk ${chunkIndex + 1}/${totalChunks}`)
        resolve()
      }

      utterance.onerror = (event) => {
        console.error(`TTS: Error in chunk ${chunkIndex + 1}:`, event.error)
        reject(new Error(`Speech synthesis failed: ${event.error}`))
      }

      speechSynthesis.speak(utterance)
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
      console.log('No voices available')
      return null
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
      console.log(`Found ${voices.length} voices matching browser country ${browserCountry} : ${voices.map(v => v.name).join(', ')}`)
    }
    // Check for google voice specifically
    const googleVoice = voices.find(voice => 
      voice.name.toLowerCase().includes("google")
    )
    if (googleVoice) {
      console.log('Found google voice:', googleVoice.name, googleVoice.lang)
    } else {
      console.log('No google voice found. Available voice names:', voices.map(v => v.name))
    }

    // select siri voice specifically from country voices
    const siriVoice = countryVoices.find(voice => 
      voice.name.toLowerCase().includes("siri")
    )
    if (siriVoice) {
      console.log('Found siri voice:', siriVoice.name, siriVoice.lang)
    }
    
    // Prefer google voice FIRST, then language-based fallbacks
    const preferredVoice = siriVoice || googleVoice || voices.find(voice => 
      voice.lang.startsWith('en') ||
      voice.lang.startsWith('fr') ||
      voice.default
    ) || voices[0]
    
    console.log('Selected voice:', preferredVoice.name, preferredVoice.lang)
    return preferredVoice
  }

  async playAudio(text, key) {
    // Final deduplication check - prevent the same audio from playing simultaneously
    if (this.currentlyPlayingKey === key) {
      console.log('TTS: Already playing this content, skipping')
      return
    }
    
    // Check if any audio is currently playing the same content
    if (window.CurrentlyPlayingTTSKey === key) {
      console.log('TTS: Content already playing globally, skipping')
      return
    }
    
    // Mark this audio as currently playing
    this.currentlyPlayingKey = key
    window.CurrentlyPlayingTTSKey = key
    
    try {
      console.log('TTS: Starting speech synthesis for text:', text.substring(0, 50) + '...')
      
      // Check browser support
      if (!('speechSynthesis' in window)) {
        throw new Error('Speech synthesis not supported')
      }

      // iOS-specific handling with debugging
      if (this.isIOS()) {
        console.log('TTS: iOS detected, audio unlock status:', window.__audioUnlocked)
        if (!window.__audioUnlocked) {
          throw new Error('Audio not unlocked on iOS')
        }
      }

      // Select the best available voice
      console.log('TTS: Selecting voice...')
      const selectedVoice = await this.selectBestVoice()
      console.log('TTS: Voice selected:', selectedVoice?.name || 'default')
      
      // Split text into manageable chunks
      const chunks = this.splitTextIntoChunks(text)
      console.log(`TTS: Split text into ${chunks.length} chunks`)

      // Update button to show it's starting
      const btn = window.GlobalTTSManager.getButtonByMessageId(this.currentMessageId)
      if (btn) {
        console.log('TTS: Setting button to stop state')
        window.GlobalTTSManager.setStopState(btn)
      }

      // Speak each chunk sequentially
      for (let i = 0; i < chunks.length; i++) {
        // Check if we should stop (user clicked stop or speech was cancelled)
        if (this.currentlyPlayingKey !== key) {
          console.log('TTS: Speech was cancelled, stopping')
          break
        }

        console.log(`TTS: Starting chunk ${i + 1}/${chunks.length}`)
        await this.speakChunk(chunks[i], selectedVoice, i, chunks.length)
        
        // Small delay between chunks to prevent issues
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      console.log('TTS: Completed all chunks successfully')

    } catch (error) {
      console.error('TTS playback error:', error.message)
      // Clear markers on error
      this.currentlyPlayingKey = null
      window.CurrentlyPlayingTTSKey = null
      throw error
    } finally {
      // Clear markers on completion
      this.currentlyPlayingKey = null
      window.CurrentlyPlayingTTSKey = null
      console.log('TTS: Playback finished, cleared markers')
    }
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
    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      console.log('TTS: Speech synthesis cancelled')
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
    
    // Clear frontend request queue
    this.requestQueue = []
    this.processingRequest = false
    
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
    
    try {
      console.log('Starting iOS audio unlock for Speech Synthesis...')
      
      // Small delay to ensure "Enabling Audio..." is visible
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // For Speech Synthesis, we mainly need user gesture
      // Test if speechSynthesis works
      if ('speechSynthesis' in window) {
        console.log('Speech Synthesis available')
        
        // Try to speak a silent utterance to unlock
        const testUtterance = new SpeechSynthesisUtterance('')
        testUtterance.volume = 0
        speechSynthesis.speak(testUtterance)
        
        // Wait a moment for the test
        await new Promise(resolve => setTimeout(resolve, 100))
        
        console.log('Speech Synthesis test completed')
        window.__audioUnlocked = true
        
        // Process pending texts
        if (this.pendingIOSTexts && this.pendingIOSTexts.length > 0) {
          console.log('Processing', this.pendingIOSTexts.length, 'pending texts')
          const pendingTexts = this.pendingIOSTexts
          this.pendingIOSTexts = []
          
          setTimeout(() => {
            pendingTexts.forEach(({ text, messageId }) => {
              this.enqueue(text, messageId)
            })
          }, 100)
        }
        
        return true
      } else {
        console.log('Speech Synthesis not available')
        return false
      }
    } catch (error) {
      console.log('iOS audio unlock error:', error.message)
      // For Speech Synthesis, even errors can indicate unlock worked
      window.__audioUnlocked = true
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
} 