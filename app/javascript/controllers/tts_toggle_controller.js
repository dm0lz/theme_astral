import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "checkbox" ]

  connect() {
    window.addEventListener('tts:enabled', (e)=> this.update(e.detail))
    this.update(JSON.parse(localStorage.getItem('ttsEnabled') ?? 'true'))
  }

  toggle() {
    window.dispatchEvent(new Event('tts:toggle'))
  }

  update(state) {
    this.enabled = state
    if (this.hasCheckboxTarget) {
      this.checkboxTarget.checked = this.enabled
    }
    this.element.title = this.enabled ? 'Disable TTS' : 'Enable TTS'
  }
} 