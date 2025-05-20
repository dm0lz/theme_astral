class Scraper::WebPagesService < BaseService
  def initialize(urls)
    @urls = urls
  end

  def call(js_script = js_code)
    cleaned_urls = clean_urls(@urls)
    Scraper::PagesEvaluatorService.new(cleaned_urls).call(js_script)
  end

  private
  def clean_urls(urls)
    urls.map do |url|
      uri = URI.parse(url)
      uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS) ? uri.to_s : nil
    end.compact
  end

  def js_code
    <<-JS
      return {
        url: document.location.href,
        content: document.body.innerText
      }
    JS
  end
end
