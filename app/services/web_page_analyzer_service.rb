class WebPageAnalyzerService < BaseService
  def initialize(url)
    @url = url
  end

  def call(prompt)
    return unless valid_url?(@url)
    web_page = Scraper::WebPageService.new(@url).call
    response = Ai::Openai::ChatService.new.call(user_prompt(prompt, web_page), response_schema)
    response["analysis"].strip
  end

  private
  def valid_url?(url)
    uri = URI.parse(url)
    uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
  rescue URI::InvalidURIError
    logger.error "Invalid URL format: #{url}"
    false
  end

  def user_prompt(prompt, web_page)
    <<-TXT
      #{prompt}
      Content to analyze : #{web_page["content"]}
    TXT
  end

  def response_schema
    {
      "strict": true,
      "name": "Web page analyzer",
      "description": "Analyzes the content of a web page and extracts information",
      "schema": {
        "type": "object",
        "properties": {
          "analysis": {
            "type": "string",
            "description": "the extracted information from the web page"
          }
        },
        "additionalProperties": false,
        "required": [ "analysis" ]
      }
    }
  end
end
