import { Controller } from "@hotwired/stimulus"

// Very small silent audio (1 frame) – useful for unlocking audio on iOS
const SILENT_MP3 =
  "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA//////////8ANmV4dGEAAAAPAAAACAAABAAFAAEAAAEJbGF2ZjU3LjMyLjEwMA==";

class TTSManager {
  constructor() {
    this.queue = [];
    this.audio = new Audio();
    // Ensure iOS inline playback
    this.audio.setAttribute("playsinline", "");
    this.prepared = false;
    this.playing = false;
    this.silentPlaying = false;

    // Load persisted state (default true)
    this.enabled = JSON.parse(localStorage.getItem("ttsEnabled") ?? "true");

    // Event wiring
    window.addEventListener("tts:toggle", this.toggleEnabled.bind(this));
    window.addEventListener("tts:prepare", this.prepareAudio.bind(this));

    // Auto-notify UI of initial state
    window.dispatchEvent(new CustomEvent("tts:enabled", { detail: this.enabled }));

    // Determine default voice
    const savedVoice = localStorage.getItem("ttsVoice");
    this.selectedVoice = savedVoice || "en-US-Chirp-HD-F";

    window.addEventListener("tts:voice", (e) => {
      this.selectedVoice = e.detail;
    });

    // Start a silence loop right after the initial user-gesture unlock
    window.addEventListener("tts:prepare", () => {
      this._startSilenceLoop();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Public helpers ---------------------------------------------------- */
  /* ------------------------------------------------------------------ */

  enqueue(text, options = {}) {
    if (!text?.trim()) return;
    if (!this.enabled) return;

    this.prepareAudio();

    const mergedOptions = { ...options, voice: options.voice || this.selectedVoice };

    const item = {
      text: text.trim(),
      options: mergedOptions,
      blobPromise: this._fetchAudio(text.trim(), mergedOptions).catch((err) => {
        console.error("TTS fetch error", err);
        return null;
      }),
    };

    this.queue.push(item);
    if (!this.playing) {
      // stop silence and start playing next
      this._stopSilenceLoop();
      this._playNext();
    }
  }

  speakImmediately(text, options = {}) {
    if (!text?.trim()) return;
    this.queue = [];
    this.enqueue(text, { ...options, voice: this.selectedVoice });
  }

  /* ------------------------------------------------------------------ */
  /* Internal helpers -------------------------------------------------- */
  /* ------------------------------------------------------------------ */

  toggleEnabled() {
    this.enabled = !this.enabled;
    localStorage.setItem("ttsEnabled", JSON.stringify(this.enabled));
    window.dispatchEvent(new CustomEvent("tts:enabled", { detail: this.enabled }));

    if (!this.enabled) {
      // Stop any playing audio and clear queue
      try {
        this.audio.pause();
      } catch (_) {}
      this.queue = [];
      this.playing = false;
      this._stopSilenceLoop();
    }
  }

  prepareAudio() {
    if (this.prepared) return;
    this.prepared = true;

    // ── Detect platform ───────────────────────────────────────────────
    const isiOS = /iPad|iPhone|iPod/.test(navigator.platform) || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 0);

    // Desktop / Android: just make sure a Web-Audio context is resumed.
    if (!isiOS) {
      if (window.AudioContext) {
        try {
          const ctx = new AudioContext();
          if (ctx.state === "suspended") ctx.resume();
        } catch (_) {}
      }
      return; // nothing else needed
    }

    // ── iOS unlock: play 1-frame silent MP3 on the same element ───────
    try {
      this.audio.src = SILENT_MP3;
      this.audio.volume = 0;
      this.audio.play()
        .then(() => setTimeout(() => {
          this.audio.pause();
          this.audio.currentTime = 0;
          this.audio.volume = 1;
        }, 150))
        .catch(() => {});
    } catch (_) {}

    // Also resume a Web-Audio context (some WebKit versions require this)
    if (window.AudioContext) {
      try {
        const ctx = new AudioContext();
        if (ctx.state === "suspended") ctx.resume();
      } catch (_) {}
    }
  }

  async _fetchAudio(text, { voice = null, speed = 1.0 } = {}) {
    const v = voice || localStorage.getItem("ttsVoice") || this.selectedVoice;
    const tryFetch = async (voiceName) => {
      const response = await fetch("/api/google_tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceName, speed }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`status ${response.status} - ${errText}`);
      }
      return await response.blob();
    };

    try {
      return await tryFetch(v);
    } catch (err) {
      console.warn("Voice", v, "failed, falling back", err);
      // fallback to safe voice
      const fallback = "en-US-Neural2-A";
      if (v !== fallback) {
        try {
          return await tryFetch(fallback);
        } catch (_) {
          throw err; // rethrow original
        }
      }
      throw err;
    }
  }

  async _playNext() {
    if (!this.enabled) return;
    

    this.playing = true;
    const item = this.queue[0];
    let blob;
    try {
      blob = await item.blobPromise;
    } catch (_) {
      // Skip bad item
      this.queue.shift();
      this._playNext();
      return;
    }

    if (!blob) {
      this.queue.shift();
      this._playNext();
      return;
    }

    const url = URL.createObjectURL(blob);
    this.audio.pause();
    this.audio.loop = false;
    this.audio.src = url;
    this.audio.volume = 1;
    try {
      await this.audio.play();
      if (this.queue.length === 0) {
        this.playing = false;
        // resume silence so autoplay stays unlocked
        this._startSilenceLoop();
        // auto-trigger voice toggle button if present (simulate user-ready state)
        this._triggerVoiceToggle();
        console.log("queue is empty, triggering voice toggle");
        return;
      }
    } catch (err) {
      console.error("Audio play error", err);
    }
    // when ended, revoke URL and move on
    this.audio.onended = () => {
      URL.revokeObjectURL(url);
      this.queue.shift();
      if (this.queue.length > 0) {
        this._playNext();
      } else {
        console.log("queue is empty, triggering voice toggle");
        this.playing = false;
        this._startSilenceLoop();
        this._triggerVoiceToggle();
      }
    };
  }

  /* ------------------------------------------------------------ */
  /* Silence loop helpers                                         */
  /* ------------------------------------------------------------ */

  _startSilenceLoop() {
    if (this.silentPlaying || !this.enabled) return;
    this.silentPlaying = true;
    this.audio.loop = true;
    this.audio.src = SILENT_MP3;
    this.audio.volume = 0;
    this.audio.play().catch(() => {});
  }

  _stopSilenceLoop() {
    if (!this.silentPlaying) return;
    this.silentPlaying = false;
    try {
      this.audio.pause();
    } catch (_) {}
  }

  _triggerVoiceToggle() {
    const btn = document.getElementById("voice-toggle-btn");
    if (btn) {
      btn.dispatchEvent(new Event("click", { bubbles: true }));
    }
  }
}

export default class extends Controller {
  connect() {
    if (!window.ttsManager) {
      window.ttsManager = new TTSManager();
    }
  }
} 