import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = {
    voices: Object,
  };

  connect() {
    this.initVoices();
    this.buildSelect();
  }

  initVoices() {
    // Minimal voice mapping with Chirp first
    this.voices = {
      en: ["en-US-Chirp-HD-F", "en-US-Chirp-HD-D", "en-US-Neural2-A"],
      fr: ["fr-FR-Chirp-HD-F", "fr-FR-Neural2-D", "fr-FR-Neural2-A"],
      es: ["es-ES-Chirp-HD-D", "es-ES-Neural2-A"],
      de: ["de-DE-Chirp-HD-D", "de-DE-Neural2-C"],
      it: ["it-IT-Chirp-HD-F", "it-IT-Neural2-D", "it-IT-Neural2-A"],
    };
  }

  buildSelect() {
    // Determine browser language
    const langCodeFull = navigator.language || "en-US";
    const lang = langCodeFull.split("-")[0];

    const select = this.element;

    // Ensure id for CSS/test
    if (!select.id) select.id = "tts-voice-select";

    // Build options
    const voicesForLang = this.voices[lang] || this.voices["en"];
    voicesForLang.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

    // Add a divider when not english
    if (lang !== "en") {
      this.voices["en"].forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });
    }

    // current selection
    const saved = localStorage.getItem("ttsVoice");
    select.value = saved || voicesForLang[0];

    // initial dispatch
    this.dispatchVoice(select.value);
  }

  change(event) {
    const voice = event.target.value;
    this.dispatchVoice(voice);
  }

  dispatchVoice(voice) {
    localStorage.setItem("ttsVoice", voice);
    window.dispatchEvent(new CustomEvent("tts:voice", { detail: voice }));
  }
} 