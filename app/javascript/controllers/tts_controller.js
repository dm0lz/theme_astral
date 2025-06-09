import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["chunks"]
  static values = {
    enabled: { type: Boolean, default: true },
    text:     { type: String,  default: "" }
  }

  connect () {
    this.synth            = window.speechSynthesis
    this.voice            = this.synth.getVoices().find(v => v.lang === navigator.language) || this.synth.getVoices()[0]
    this.isCurrentlySpeaking = false
    this.spokenSentences   = new Set()
    this.addStreamingToggleButton()

    // When the controller is tied to a streaming message (has chunks target)
    if (this.hasChunksTarget) {
      this.observeChunks()
    } else {
      // For a normal message button: if TTS engine is currently speaking, reflect stop state
      if (window.speechSynthesis.speaking) {
        this.setButtonToStop(this.element)
      }
    }
  }

  disconnect () {
    if (this.observer) this.observer.disconnect()
    if (!this.isCurrentlySpeaking) this.synth.cancel()
  }

  /* ------------------------------------------------------------------
   * STREAMING SUPPORT (AI messages rendered progressively)
   * ----------------------------------------------------------------*/
  observeChunks () {
    this.observer = new MutationObserver(() => {
      if (!this.enabledValue) return
      const text = this.chunksTarget.textContent || ""
      const parts = text.split(/([.!?]+)/)
      for (let i = 0; i < parts.length - 1; i += 2) {
        const sentence = (parts[i] + parts[i + 1]).trim()
        if (sentence && !this.spokenSentences.has(sentence)) {
          this.spokenSentences.add(sentence)
          this.speak(sentence)
        }
      }
    })
    this.observer.observe(this.chunksTarget, { childList: true, subtree: true })
  }

  /* ------------------------------------------------------------------
   * GENERIC SPEAK
   * ----------------------------------------------------------------*/
  speak (text) {
    if (!this.enabledValue || !text) return
    const utter = new SpeechSynthesisUtterance(text)
    utter.voice = this.voice

    utter.onstart = () => {
      this.isCurrentlySpeaking = true
      // If we are in a streaming controller with a toggle button, switch it to stop icon once
      if (this.toggleBtn && !this.toggleBtn.dataset.speaking) {
        this.setButtonToStop(this.toggleBtn)
      }
    }
    
    utter.onend   = () => {
      // Defer a little to allow the next queued utterance (if any) to start
      setTimeout(() => {
        if (!this.synth.speaking) {
          this.isCurrentlySpeaking = false
          if (this.toggleBtn) this.resetButton(this.toggleBtn)
        }
      }, 100)
    }
    utter.onerror = () => {
      this.isCurrentlySpeaking = false
      if (this.toggleBtn) this.resetButton(this.toggleBtn)
    }

    this.synth.speak(utter)
  }

  /* ------------------------------------------------------------------
   * MESSAGE-LEVEL BUTTON (non-streaming)
   * ----------------------------------------------------------------*/
  speakMessage (e) {
    const btn  = e.currentTarget

    // If already reading this exact message → stop it
    if (btn.dataset.speaking === "true") {
      this.synth.cancel()
      this.resetButton(btn)
      return
    }

    const text = this.textValue || btn.dataset.ttsTextValue
    if (!text) return

    // Cancel whatever is playing and reset all TT buttons
    this.synth.cancel()
    document.querySelectorAll('[data-action*="tts#speakMessage"]').forEach(this.resetButton)

    const utter = new SpeechSynthesisUtterance(text)
    utter.voice = this.voice

    utter.onstart = () => this.setButtonToStop(btn)
    utter.onend   = () => this.resetButton(btn)
    utter.onerror = () => this.resetButton(btn)

    this.synth.speak(utter)
  }

  /* ------------------------------------------------------------------
   * BTN HELPERS
   * ----------------------------------------------------------------*/
  setButtonToStop = (btn) => {
    btn.innerHTML        = "⏹️"
    btn.style.color      = "#ef4444"
    btn.dataset.speaking = "true"
    btn.title            = "Stop reading"
  }

  resetButton = (btn) => {
    btn.innerHTML        = "🔊"
    btn.style.color      = ""
    btn.dataset.speaking = "false"
    btn.title            = "Read message aloud"
  }

  /* ------------------------------------------------------------------
   * STREAMING TOGGLE BUTTON (a single toggle for live AI stream)
   * ----------------------------------------------------------------*/
  addStreamingToggleButton () {
    if (!this.hasChunksTarget) return
    const container = this.element.querySelector('.flex.items-center.space-x-2:first-child')
    if (!container) return

    const btn       = document.createElement('button')
    btn.innerHTML   = "🔊"
    btn.className   = 'text-white/70 hover:text-white transition-colors duration-200 p-1 rounded hover:bg-white/10'
    btn.onclick     = () => {
      this.enabledValue = !this.enabledValue
      btn.style.color   = this.enabledValue ? '#22c55e' : ''
      if (!this.enabledValue) this.synth.cancel()
    }
    container.appendChild(btn)
    this.toggleBtn = btn
  }
}