import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["chunks"]

  connect() {
    // Ensure the global manager exists
    this.player = window.ttsManager;

    // If this element has a chunks target, set up mutation observer
    if (this.hasChunksTarget) {
      this._observeSentenceChunks();
    }
  }

  disconnect() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  /* ------------------------------------------------------------ */
  /* Speak entire message when user clicks the play icon          */
  /* ------------------------------------------------------------ */
  speakMessage(event) {
    // make sure we have the latest manager
    this.player ||= window.ttsManager

    const button = event.currentTarget
    const rawText = button?.dataset?.ttsTextValue
    const text    = this._sanitize(rawText)

    // show spinner
    this._toggleSpinner(button, true)

    if (text && this.player) {
      console.log('speakMessage', text)

      // hide spinner when audio stops (or fails)
      const stopLoading = () => {
        this._toggleSpinner(button, false)
        this.player.audio.removeEventListener('ended', stopLoading)
        this.player.audio.removeEventListener('error', stopLoading)
      }
      this.player.audio.addEventListener('ended', stopLoading)
      this.player.audio.addEventListener('error', stopLoading)

      this.player.speakImmediately(text)
    } else {
      // player not ready – revert UI
      this._toggleSpinner(button, false)
      console.warn('Cannot speak message', { text, player: this.player })
    }
  }

  /* ------------------------------------------------------------ */
  /* Helper: toggle speaker ↔ spinner                              */
  /* ------------------------------------------------------------ */
  _toggleSpinner(button, loading) {
    const speakerIcon = button.querySelector('.speaker-icon')
    const spinnerIcon = button.querySelector('.spinner-icon')
    if (!speakerIcon || !spinnerIcon) return

    if (loading) {
      button.dataset.speaking = 'true'
      speakerIcon.classList.add('hidden')
      spinnerIcon.classList.remove('hidden')
    } else {
      button.dataset.speaking = 'false'
      spinnerIcon.classList.add('hidden')
      speakerIcon.classList.remove('hidden')
    }
  }

  /* ------------------------------------------------------------ */
  /* Helper: sanitize text before sending to TTS                   */
  /* ------------------------------------------------------------ */
  _sanitize(text) {
    if (!text) return "";
    return text
      // Remove markdown formatting characters like * or #
      .replace(/[\*#]/g, "")
      // Remove common sparkle, moon and other emoji/symbol ranges
      .replace(/[\u{1F300}-\u{1F64F}\u{2700}-\u{27BF}]/gu, "")
      .trim();
  }

  /* ------------------------------------------------------------ */
  /* Observe streaming sentence chunks                            */
  /* ------------------------------------------------------------ */
  _observeSentenceChunks() {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          let text = (node.textContent || "").trim();
          if (text && !text.startsWith("BEGIN") && !text.startsWith("END")) {
            console.log("enqueueing sentences", text);
            this._enqueueSentences(text);
          }
        });
      });
    });

    this.mutationObserver.observe(this.chunksTarget, {
      childList: true,
    });
  }

  _enqueueSentences(text) {
    if (!this.player) return;

    // Split by sentence endings (., !, ?) keeping delimiter
    const sentences = text.match(/[^\.\!\?]+[\.\!\?]+|[^\.\!\?]+/g) || [];
    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      const clean   = this._sanitize(trimmed);
      if (clean) {
        this.player.enqueue(clean);
      }
    });
  }
}
