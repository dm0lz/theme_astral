// app/javascript/controllers/scroll_into_view_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.element.scrollIntoView({ behavior: "smooth" })
  }
}
