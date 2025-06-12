import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  prepare() {
    window.dispatchEvent(new Event("tts:prepare"));
  }
} 