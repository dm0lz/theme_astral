import { Controller } from "@hotwired/stimulus"

// Global state shared across controller instances
window._ttsState = window._ttsState || {
  spoken: new Set(),
  queued: new Set(),
  queue: [],
  currentAudio: null,
  speaking: false
}

// helper functions
const fingerprint = (s) => {
  return s
    .toLowerCase()
    .replace(/\s+/g," ")            // collapse whitespace
    .replace(/[\.\!\?]+$/, "")    // drop ending punctuation
    .trim();
}

export default class extends Controller {
  static targets = ["chunks"]
  static values = {
    enabled: { type: Boolean, default: true },
    text:     { type: String,  default: "" }
  }

  connect() {
    this.addStreamingToggleButton()
    
    // Register button with global state manager
    const button = this.hasChunksTarget ? this.toggleBtn : this.element
    if (button && window.GlobalTTSManager) {
      window.GlobalTTSManager.registerButton(button)
    }

    // When the controller is tied to a streaming message (has chunks target)
    if (this.hasChunksTarget) {
      this.observeChunks()
    }
  }

  disconnect() {
    if (this.observer) this.observer.disconnect()
    
    // Unregister button from global state manager
    const button = this.hasChunksTarget ? this.toggleBtn : this.element
    if (button && window.GlobalTTSManager) {
      window.GlobalTTSManager.unregisterButton(button)
    }
  }

  /* ------------------------------------------------------------------
   * STREAMING SUPPORT (AI messages rendered progressively)
   * ----------------------------------------------------------------*/
  observeChunks() {
    this.observer = new MutationObserver((mutations) => {
      if (!this.enabledValue) return
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          let raw = (node.textContent || "").replace(/\s+/g," ").trim();
          if (!raw) return;
          if (!/[.!?]$/.test(raw)) return; // only complete sentence

          // Dispatch to global controller
          window.dispatchEvent(new CustomEvent('tts:add', { detail: raw }))
        })
      })
    })
    this.observer.observe(this.chunksTarget, { childList: true, subtree: true })
  }

  /* ------------------------------------------------------------------
   * MESSAGE-LEVEL BUTTON (non-streaming)
   * ----------------------------------------------------------------*/
  speakMessage(e) {
    const btn = e.currentTarget
    const text = this.textValue || btn.dataset.ttsTextValue
    if (!text) return

    // If TTS is currently active -> stop
    if (window.GlobalTTSManager && window.GlobalTTSManager.isActive) {
      window.dispatchEvent(new CustomEvent("tts:stop"))
      return
    }

    // Dispatch to global controller
    window.dispatchEvent(new CustomEvent("tts:add", { detail: text }))
  }

  /* ------------------------------------------------------------------
   * STREAMING TOGGLE BUTTON (enable/disable TTS for AI stream)
   * ----------------------------------------------------------------*/
  addStreamingToggleButton() {
    if (!this.hasChunksTarget) return
    const container = this.element.querySelector('.flex.items-center.space-x-2:first-child')
    if (!container) return

    const btn = document.createElement('button')
    btn.innerHTML = `
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5 9v6h4l5 5V4L9 9H5z"></path>
        <path d="M15 9.5a3.5 3.5 0 010 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M17.5 7a6 6 0 010 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>`
    btn.className = 'text-white/70 hover:text-white transition-colors duration-200 p-1 rounded hover:bg-white/10'
    btn.onclick = () => {
      this.enabledValue = !this.enabledValue
      btn.style.color = this.enabledValue ? '#22c55e' : ''
      if (!this.enabledValue) {
        window.dispatchEvent(new CustomEvent("tts:stop"))
      }
    }
    container.appendChild(btn)
    this.toggleBtn = btn
    
    // Register this button immediately
    if (window.GlobalTTSManager) {
      window.GlobalTTSManager.registerButton(btn)
    }
  }
}