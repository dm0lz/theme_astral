import { Controller } from "@hotwired/stimulus"

/**
 * Individual TTS Controller
 * Handles UI interactions and delegates to the global TTS system
 */
export default class extends Controller {
  static targets = ["chunks"]
  static values = {
    enabled: { type: Boolean, default: true },
    text: { type: String, default: "" }
  }

  connect() {
    this.initializeButton()
    this.registerWithGlobalManager()
    this.setupStreamingObserver()
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

    this.observer = new MutationObserver((mutations) => {
      if (!this.enabledValue) return
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          this.handleStreamingContent(node)
        })
      })
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

  handleStreamingContent(node) {
    const text = this.extractText(node)
    if (!text || !this.isCompleteSentence(text)) return
    
    const messageId = this.getStreamingMessageId()
    this.dispatchTTS(text, messageId)
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

  dispatchTTS(text, messageId) {
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
    return this.element.querySelector('.flex.items-center.space-x-2:first-child')
  }

  buildToggleButton() {
    const button = document.createElement('button')
    button.className = 'text-white/70 hover:text-white transition-colors duration-200 p-1 rounded hover:bg-white/10'
    button.innerHTML = this.getSpeakerIcon()
    button.onclick = () => this.handleToggleClick(button)
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
  }

  cleanupObserver() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }

  unregisterFromGlobalManager() {
    const button = this.getButton()
    if (button && window.GlobalTTSManager) {
      window.GlobalTTSManager.unregisterButton(button)
    }
  }
}