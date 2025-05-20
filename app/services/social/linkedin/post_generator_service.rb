class Social::Linkedin::PostGeneratorService < BaseService
  def initialize(topic)
    @topic = topic
  end

  def call
    response = Ai::Openai::ChatGptService.new.call(
      user_prompt: user_prompt,
      system_prompt: system_prompt,
      response_schema: response_schema
    )
    response["post"]
  end

  private
  def user_prompt
    <<-TXT
      Create a professional LinkedIn post (max 1300 characters) promoting ScrapeLabs.
  
      ✦ Make it informative and engaging for a business and tech-savvy audience.
      ✦ Highlight high-value features such as:
        - AI-powered & custom web scraping
        - Zero-code solutions
        - Fast delivery with 100% accuracy
        - Pricing starting at $395/project
        - Real-time and scheduled data options
        - Tailored pipelines for unique needs
  
      ✦ Mention popular use cases like:
        - Market research & competitor tracking
        - Lead generation & enrichment
        - Real estate analytics
        - Dynamic pricing strategies
  
      ✦ Use relevant emojis to enhance readability and interest.
      ✦ End with a strong call to action (e.g., “Start your project today,” “Let’s talk data!”).
      ✦ Include this link: https://www.theme-astral.me
      ✦ Use one relevant hashtag (e.g., #WebScraping, #DataDrivenDecisions) or create a custom one.
  
      Topic: #{@topic}
    TXT
  end

  def system_prompt
    <<-TXT
      You are a professional marketing assistant creating LinkedIn posts for ScrapeLabs — a company offering AI-powered and custom web scraping services.
  
      Your task is to write informative, engaging, and concise LinkedIn posts that resonate with decision-makers, marketers, analysts, and data professionals. Emphasize ScrapeLabs’ key differentiators: expert-driven service, zero-code solutions, fast turnaround, and custom pipelines for diverse use cases.
  
      Write with a tone that is professional, insightful, and approachable. Use relevant emojis to increase engagement and break up content visually. Always include:
      - A compelling insight or benefit
      - A call to action (e.g., “Start your project today”)
      - The link: https://www.theme-astral.me
      - One business-relevant hashtag
    TXT
  end

  def response_schema
    {
      "strict": true,
      "name": "post_Generator",
      "description": "Generate a post",
      "schema": {
        "type": "object",
        "properties": {
          "post": {
            "type": "string",
            "description": "post content"
          }
        },
        "additionalProperties": false,
        "required": [ "post" ]
      }
    }
  end
end
