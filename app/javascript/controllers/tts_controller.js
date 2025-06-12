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
    const text = event.currentTarget?.dataset?.ttsTextValue;
    if (text && this.player) {
      this.player.speakImmediately(text);
    }
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
      if (trimmed) {
        this.player.enqueue(trimmed);
      }
    });
  }
}
