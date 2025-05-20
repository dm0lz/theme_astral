class Scraper::WebPageService < BaseService
  def initialize(url)
    @url = url
  end

  def call(js_script = js_code)
    return unless valid_url?(@url)
    # proxy = "socks5://127.0.0.1:9050"
    # proxy = "socks5://198.100.154.198:6001"
    # options = "{proxy: {server: \"#{proxy}\"}}"
    Scraper::PageEvaluatorService.new(@url).call(js_script)
  end

  private
  def valid_url?(url)
    uri = URI.parse(url)
    uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
  rescue URI::InvalidURIError
    logger.error "Invalid URL format: #{url}"
    false
  end

  def js_code
    <<-JS
      return {
        content: document.body.innerText
      }
    JS
  end
end
