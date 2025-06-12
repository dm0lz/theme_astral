import { Controller } from "@hotwired/stimulus";

// Full Google TTS voices list (expand with all voices from https://cloud.google.com/text-to-speech/docs/list-voices-and-types?hl=fr)
const GOOGLE_TTS_VOICES = [
  // English - US
  { name: "en-US-Chirp-HD-F", label: "Chirp HD F (US)", quality: 1, language: "en", country: "US" },
  { name: "en-US-Chirp-HD-D", label: "Chirp HD D (US)", quality: 1, language: "en", country: "US" },
  { name: "en-US-Neural2-A", label: "Neural2 A (US)", quality: 2, language: "en", country: "US" },
  { name: "en-US-Neural2-B", label: "Neural2 B (US)", quality: 2, language: "en", country: "US" },
  { name: "en-US-Neural2-C", label: "Neural2 C (US)", quality: 2, language: "en", country: "US" },
  { name: "en-US-Neural2-D", label: "Neural2 D (US)", quality: 2, language: "en", country: "US" },
  { name: "en-US-Neural2-E", label: "Neural2 E (US)", quality: 2, language: "en", country: "US" },
  { name: "en-US-Neural2-F", label: "Neural2 F (US)", quality: 2, language: "en", country: "US" },
  { name: "en-US-Wavenet-A", label: "Wavenet A (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Wavenet-B", label: "Wavenet B (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Wavenet-C", label: "Wavenet C (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Wavenet-D", label: "Wavenet D (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Wavenet-E", label: "Wavenet E (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Wavenet-F", label: "Wavenet F (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Wavenet-G", label: "Wavenet G (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Wavenet-H", label: "Wavenet H (US)", quality: 3, language: "en", country: "US" },
  { name: "en-US-Standard-A", label: "Standard A (US)", quality: 4, language: "en", country: "US" },
  { name: "en-US-Standard-B", label: "Standard B (US)", quality: 4, language: "en", country: "US" },
  { name: "en-US-Standard-C", label: "Standard C (US)", quality: 4, language: "en", country: "US" },
  { name: "en-US-Standard-D", label: "Standard D (US)", quality: 4, language: "en", country: "US" },
  { name: "en-US-Standard-E", label: "Standard E (US)", quality: 4, language: "en", country: "US" },
  { name: "en-US-Standard-F", label: "Standard F (US)", quality: 4, language: "en", country: "US" },
  // English - GB
  { name: "en-GB-Chirp-HD-B", label: "Chirp HD B (UK)", quality: 1, language: "en", country: "GB" },
  { name: "en-GB-Neural2-A", label: "Neural2 A (UK)", quality: 2, language: "en", country: "GB" },
  { name: "en-GB-Neural2-B", label: "Neural2 B (UK)", quality: 2, language: "en", country: "GB" },
  { name: "en-GB-Wavenet-A", label: "Wavenet A (UK)", quality: 3, language: "en", country: "GB" },
  { name: "en-GB-Wavenet-B", label: "Wavenet B (UK)", quality: 3, language: "en", country: "GB" },
  { name: "en-GB-Standard-A", label: "Standard A (UK)", quality: 4, language: "en", country: "GB" },
  // French - FR (all voices from Google Cloud TTS docs as of June 2024)
  // Chirp3 HD voices
  { name: "fr-FR-Chirp-HD-O", label: "Chirp3 HD O (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp-HD-F", label: "Chirp3 HD F (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Alnilam", label: "Chirp3 HD Alnilam (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Aoede", label: "Chirp3 HD Aoede (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Autonoe", label: "Chirp3 HD Autonoe (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Callirrhoe", label: "Chirp3 HD Autonoe (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Despina", label: "Chirp3 HD Despina (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Erinome", label: "Chirp3 HD Erinome (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Gacrux", label: "Chirp3 HD Gacrux (FR)", quality: 1, language: "fr", country: "FR" },
  { name: "fr-FR-Chirp3-HD-Kore", label: "Chirp3 HD Kore (FR)", quality: 1, language: "fr", country: "FR" },
  // Chirp HD voices
  { name: "fr-FR-Neural2-A", label: "Neural2 A (FR)", quality: 2, language: "fr", country: "FR" },
  { name: "fr-FR-Neural2-B", label: "Neural2 B (FR)", quality: 2, language: "fr", country: "FR" },
  { name: "fr-FR-Neural2-C", label: "Neural2 C (FR)", quality: 2, language: "fr", country: "FR" },
  { name: "fr-FR-Neural2-D", label: "Neural2 D (FR)", quality: 2, language: "fr", country: "FR" },
  // Wavenet voices
  { name: "fr-FR-Wavenet-A", label: "Wavenet A (FR)", quality: 3, language: "fr", country: "FR" },
  { name: "fr-FR-Wavenet-B", label: "Wavenet B (FR)", quality: 3, language: "fr", country: "FR" },
  { name: "fr-FR-Wavenet-C", label: "Wavenet C (FR)", quality: 3, language: "fr", country: "FR" },
  { name: "fr-FR-Wavenet-D", label: "Wavenet D (FR)", quality: 3, language: "fr", country: "FR" },
  // Standard voices
  { name: "fr-FR-Standard-A", label: "Standard A (FR)", quality: 4, language: "fr", country: "FR" },
  { name: "fr-FR-Standard-B", label: "Standard B (FR)", quality: 4, language: "fr", country: "FR" },
  { name: "fr-FR-Standard-C", label: "Standard C (FR)", quality: 4, language: "fr", country: "FR" },
  { name: "fr-FR-Standard-D", label: "Standard D (FR)", quality: 4, language: "fr", country: "FR" },
];

function getUserLangCountry() {
  const langCodeFull = navigator.language || "en-US";
  const [lang, country] = langCodeFull.split("-");
  return { lang: lang || "en", country: (country || "US").toUpperCase() };
}

export default class extends Controller {
  connect() {
    this.renderVoiceList();
    this._setupModalEvents();
  }

  renderVoiceList() {
    const { lang, country } = getUserLangCountry();
    // Filter by language+country first
    let voices = GOOGLE_TTS_VOICES.filter(v => v.language === lang && v.country === country);
    // Fallback to language only if no country match
    if (voices.length === 0) {
      voices = GOOGLE_TTS_VOICES.filter(v => v.language === lang);
    }
    // Fallback to English if still nothing
    if (voices.length === 0) {
      voices = GOOGLE_TTS_VOICES.filter(v => v.language === "en" && v.country === "US");
    }
    const saved = localStorage.getItem("ttsVoice") || (voices[0] && voices[0].name);
    const container = document.getElementById("tts-voice-list");
    if (!container) return;
    container.innerHTML = "";
    voices
      .slice()
      .sort((a, b) => a.quality - b.quality)
      .forEach((voice) => {
        const row = document.createElement("div");
        row.className =
          "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors duration-150 " +
          (voice.name === saved
            ? "bg-indigo-700/80 border border-amber-400 shadow"
            : "bg-indigo-900/40 hover:bg-indigo-800/60 border border-transparent");
        row.dataset.voice = voice.name;
        row.onclick = () => this.selectVoice(voice.name);
        row.innerHTML = `
          <span class=\"font-medium text-indigo-100\">${voice.label}</span>
          <button type=\"button\" class=\"preview-voice-btn px-2 py-1 ml-2 rounded bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold shadow hover:from-amber-600 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition\" data-voice=\"${voice.name}\">Preview</button>
        `;
        container.appendChild(row);
      });
    // Attach preview listeners
    container.querySelectorAll(".preview-voice-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._previewVoice(btn.dataset.voice);
      });
    });
  }

  selectVoice(voice) {
    localStorage.setItem("ttsVoice", voice);
    window.dispatchEvent(new CustomEvent("tts:voice", { detail: voice }));
    this.renderVoiceList();
  }

  _setupModalEvents() {
    // Modal open/close
    const openBtn = document.getElementById("open-voice-modal");
    const closeBtn = document.getElementById("close-voice-modal");
    const modal = document.getElementById("voice-modal");
    if (openBtn && modal) {
      openBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        setTimeout(() => this.renderVoiceList(), 10);
      });
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
      });
    }
  }

  async _previewVoice(voice) {
    const sample = "Bienvenue sous les étoiles";
    try {
      const response = await fetch("/api/google_tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sample, voice }),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.setAttribute("playsinline", "");
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  }
} 