import { Controller } from "@hotwired/stimulus"

// Shows a spinner until the element receives non-empty content
export default class extends Controller {
  connect() {
    this.insertSpinner()
    // observe for new nodes/text
    this.observer = new MutationObserver(() => this.checkContent())
    this.observer.observe(this.element, { childList: true, subtree: true })
    this.checkContent()
  }

  disconnect() {
    if (this.observer) this.observer.disconnect()
  }

  insertSpinner() {
    if (this.spinner) return
    this.spinner = document.createElement('div')
    this.spinner.className = 'loading-spinner flex justify-center w-full py-2'
    this.spinner.innerHTML = `
      <svg class="w-5 h-5 animate-spin text-white opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" stroke-width="4" class="opacity-25"></circle>
        <path d="M4 12a8 8 0 018-8" stroke-width="4" stroke-linecap="round" class="opacity-75"></path>
      </svg>`
    this.element.appendChild(this.spinner)
  }

  checkContent() {
    // if there's content other than the spinner itself
    const hasRealContent = Array.from(this.element.childNodes).some(node => {
      if (node === this.spinner) return false
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim().length > 0
      if (node.nodeType === Node.ELEMENT_NODE) return true
      return false
    })

    if (hasRealContent) {
      if (this.spinner) this.spinner.remove()
    } else {
      this.insertSpinner()
    }
  }
} 