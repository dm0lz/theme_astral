import { Controller } from "@hotwired/stimulus"

/**
 * Individual TTS Controller
 * Handles UI interactions and delegates to the global TTS system
 */

// Global registry to prevent multiple streaming observers
window.TTSStreamingRegistry = window.TTSStreamingRegistry || new Set()

export default class extends Controller {
  static targets = ["chunks"]
  static values = {
    enabled: { type: Boolean, default: true },
    text: { type: String, default: "" }
  }

  connect() {
    this.initializeButton()
    this.registerWithGlobalManager()
    
    // Special handling for temp_message to prevent duplicates
    if (this.element.id === 'temp_message') {
      // Check if there are any other temp_message elements
      const existingTempMessages = document.querySelectorAll('#temp_message')
      if (existingTempMessages.length > 1) {
        // Remove older temp messages
        existingTempMessages.forEach((el, index) => {
          if (index < existingTempMessages.length - 1) {
            el.remove()
          }
        })
      }
    }
    
    // Only set up streaming observer for temp messages to prevent duplicates
    if (this.isStreamingMessage()) {
      const elementId = this.element.id || 'unknown'
      
      // Check if streaming is already handled for this element
      if (window.TTSStreamingRegistry.has(elementId)) {
        return
      }
      
      // Register this element as having streaming
      window.TTSStreamingRegistry.add(elementId)
      this.registeredForStreaming = elementId
      
      this.setupStreamingObserver()
      // Initialize processed content tracking only for streaming
      this.processedContent = new Set()
    }
  }

  disconnect() {
    this.cleanup()
  }

  // ===== INITIALIZATION =====

  initializeButton() {
    if (this.hasChunksTarget) {
      this.createStreamingToggleButton()
    }
  }

  registerWithGlobalManager() {
    const button = this.getButton()
    if (button && window.GlobalTTSManager) {
      const messageId = this.getMessageId(button)
      window.GlobalTTSManager.registerButton(button, messageId)
    }
  }

  setupStreamingObserver() {
    if (!this.hasChunksTarget) return

    // Add a debounce mechanism to prevent rapid-fire mutations
    this.pendingProcessing = new Set()
    this.processingTimeout = null

    this.observer = new MutationObserver((mutations) => {
      if (!this.enabledValue) return
      
      // Clear any pending timeout
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout)
      }
      
      // Collect all new text content
      const newTexts = new Set()
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          const text = this.extractText(node)
          if (text && this.isCompleteSentence(text)) {
            newTexts.add(text)
          }
        })
      })
      
      // Process with a small delay to batch mutations
      this.processingTimeout = setTimeout(() => {
        newTexts.forEach(text => {
          this.handleStreamingContent(text)
        })
      }, 50)
    })
    
    this.observer.observe(this.chunksTarget, { 
      childList: true, 
      subtree: true 
    })
  }

  // ===== MESSAGE ID EXTRACTION =====

  getMessageId(button) {
    // Try multiple ways to extract message ID
    let messageId = button.dataset.ttsMessageId
    
    if (!messageId) {
      // Look for closest message container with an ID
      const messageContainer = button.closest('[id*="chat_message"], [id*="temp_message"]')
      if (messageContainer) {
        messageId = messageContainer.id
      }
    }
    
    if (!messageId) {
      // Create ID from text content as fallback
      const text = this.getTextForButton(button)
      if (text) {
        messageId = 'tts_' + this.hashString(text)
      }
    }
    
    return messageId
  }

  hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString()
  }

  // ===== STREAMING CONTENT =====

  handleStreamingContent(text) {
    if (!text) return
    
    // Prevent duplicate processing of the same content
    const contentKey = this.normalizeText(text)
    
    // Check if this content is already being processed
    if (this.pendingProcessing.has(contentKey)) {
      return
    }
    
    // Global content lock to prevent race conditions between multiple controllers
    if (!window.TTSContentLock) {
      window.TTSContentLock = new Set()
    }
    
    if (window.TTSContentLock.has(contentKey)) {
      return
    }
    
    // Lock this content globally and locally
    window.TTSContentLock.add(contentKey)
    this.pendingProcessing.add(contentKey)
    
    // Also check local processed content
    if (this.processedContent.has(contentKey)) {
      window.TTSContentLock.delete(contentKey)
      this.pendingProcessing.delete(contentKey)
      return
    }
    
    this.processedContent.add(contentKey)
    
    const messageId = this.getStreamingMessageId()
    this.dispatchTTS(text, messageId)
    
    // Release locks after processing
    setTimeout(() => {
      window.TTSContentLock.delete(contentKey)
      this.pendingProcessing.delete(contentKey)
    }, 1000)
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.!?]+$/, '')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  getStreamingMessageId() {
    // For streaming messages, try to get ID from the message container
    const messageContainer = this.element.closest('[id*="temp_message"], [id*="chat_message"]')
    return messageContainer ? messageContainer.id : null
  }

  extractText(node) {
    return node.textContent?.replace(/\s+/g, " ").trim() || ""
  }

  isCompleteSentence(text) {
    return /[.!?]$/.test(text)
  }

  // ===== USER INTERACTIONS =====

  speakMessage(event) {
    const button = event.currentTarget
    const text = this.getTextForButton(button)
    
    if (!text) return
    
    if (this.isCurrentlyActive()) {
      this.stopTTS()
    } else {
      const messageId = this.getMessageId(button)
      this.dispatchTTS(text, messageId)
    }
  }

  getTextForButton(button) {
    return this.textValue || button.dataset.ttsTextValue
  }

  isCurrentlyActive() {
    return window.GlobalTTSManager?.isActive
  }

  async dispatchTTS(text, messageId) {
    window.dispatchEvent(new CustomEvent('tts:add', { 
      detail: { 
        text: text, 
        messageId: messageId 
      } 
    }))
  }

  stopTTS() {
    window.dispatchEvent(new CustomEvent('tts:stop'))
  }

  // ===== STREAMING TOGGLE BUTTON =====

  createStreamingToggleButton() {
    const container = this.findButtonContainer()
    if (!container) return

    const button = this.buildToggleButton()
    container.appendChild(button)
    this.toggleBtn = button
    
    this.registerButtonWithManager(button)
  }

  findButtonContainer() {
    // iOS-compatible container detection - avoid pseudo-selectors
    // Try multiple approaches for maximum compatibility
    
    // First try: exact class match with space-x-2
    let container = this.element.querySelector('.flex.items-center.space-x-2')
    
    if (!container) {
      // Second try: any flex container with items-center
      const flexContainers = this.element.querySelectorAll('.flex.items-center')
      if (flexContainers.length > 0) {
        // Use the last one (usually the message footer)
        container = flexContainers[flexContainers.length - 1]
      }
    }
    
    if (!container) {
      // Third try: look for any flex container
      const anyFlex = this.element.querySelectorAll('.flex')
      if (anyFlex.length > 0) {
        container = anyFlex[anyFlex.length - 1]
      }
    }
    
    return container
  }

  buildToggleButton() {
    const button = document.createElement('button')
    button.className = 'text-white/70 hover:text-white transition-colors duration-200 p-1 rounded hover:bg-white/10'
    button.innerHTML = this.getSpeakerIcon()
    button.onclick = () => this.handleToggleClick(button)
    
    // Add explicit iOS-compatible styling
    button.style.minWidth = '24px'
    button.style.minHeight = '24px'
    button.style.alignItems = 'center'
    button.style.justifyContent = 'center'
    
    // Check TTS enabled state before making visible
    if (window.__ttsEnabled) {
      button.style.display = 'inline-flex'
      button.style.opacity = '1'
      button.style.visibility = 'visible'
    } else {
      button.style.display = 'none'
      button.style.opacity = '0'
      button.style.visibility = 'hidden'
      button.classList.add('hidden')
    }
    
    // Add data attributes for easier debugging
    button.setAttribute('data-tts-button', 'streaming')
    button.setAttribute('title', 'Read message aloud')
    
    return button
  }

  getSpeakerIcon() {
    return `
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5 9v6h4l5 5V4L9 9H5z"></path>
        <path d="M15 9.5a3.5 3.5 0 010 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M17.5 7a6 6 0 010 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>`
  }

  handleToggleClick(button) {
    this.enabledValue = !this.enabledValue
    this.updateToggleButtonState(button)
    
    if (!this.enabledValue) {
      this.stopTTS()
    }
  }

  updateToggleButtonState(button) {
    button.style.color = this.enabledValue ? '#22c55e' : ''
  }

  registerButtonWithManager(button) {
    if (window.GlobalTTSManager) {
      const messageId = this.getMessageId(button)
      window.GlobalTTSManager.registerButton(button, messageId)
    }
  }

  // ===== UTILITIES =====

  getButton() {
    return this.hasChunksTarget ? this.toggleBtn : this.element
  }

  // ===== CLEANUP =====

  cleanup() {
    this.cleanupObserver()
    this.unregisterFromGlobalManager()
    
    // Remove from streaming registry if registered
    if (this.registeredForStreaming) {
      window.TTSStreamingRegistry.delete(this.registeredForStreaming)
    }
    
    // Clear processed content to prevent memory leaks (only for streaming messages)
    if (this.processedContent) {
      this.processedContent.clear()
    }
  }

  cleanupObserver() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    // Clear any pending processing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout)
      this.processingTimeout = null
    }
    
    // Clear pending processing set
    if (this.pendingProcessing) {
      this.pendingProcessing.clear()
    }
  }

  unregisterFromGlobalManager() {
    const button = this.getButton()
    if (button && window.GlobalTTSManager) {
      window.GlobalTTSManager.unregisterButton(button)
    }
  }

  // Check if this is a streaming message (temp_message)
  isStreamingMessage() {
    return this.element.id === 'temp_message' || this.hasChunksTarget
  }
}