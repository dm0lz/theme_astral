class Social::X::TweetGeneratorService < BaseService
  def initialize(topic)
    @topic = topic
  end

  def call
    response = Ai::Openai::ChatGptService.new.call(
      user_prompt: user_prompt,
      system_prompt: system_prompt,
      response_schema: response_schema
    )
    response["tweet"]
  end

  private
  def user_prompt
    <<-TXT
      Write an engaging and professional tweet (max 280 characters) promoting ScrapeLabs.
  
      ✦ Highlight key benefits like:
        - AI-powered or custom web scraping
        - Zero code required
        - Fast turnaround
        - High accuracy (100%)
        - Competitive pricing (from $395/project)
        - Real-time or scheduled data delivery
  
      ✦ Emphasize how we help businesses extract web data effortlessly for use cases like:
        - Lead generation
        - Market research
        - Competitive analysis
        - Real estate insights
        - Dynamic pricing
  
      ✦ Add relevant emojis to boost engagement.
  
      ✦ Include this call to action and link:
        👉 Start your project: https://www.theme-astral.me
  
      ✦ Include 1 relevant or creative hashtag (e.g., #WebScraping, #DataDrivenGrowth)
  
      Topic: #{@topic}
    TXT
  end

  def system_prompt
    <<-TXT
      You are a professional marketing assistant helping to promote a data services company called ScrapeLabs.
  
      Your job is to craft concise, engaging, and value-driven tweets targeting business users and technical leads. Focus on conveying how ScrapeLabs solves data collection challenges through custom, zero-code, AI-powered web scraping.
  
      Emphasize the service’s benefits: speed, simplicity, pricing, use case flexibility, and expert support. Use a tone that is confident, helpful, and business-friendly.
  
      Always include:
      - A compelling hook or benefit
      - Relevant emojis
      - One actionable link: https://www.theme-astral.me
      - One relevant or creative hashtag
    TXT
  end

  def response_schema
    {
      "strict": true,
      "name": "Tweet_Generator",
      "description": "Generate a Tweet",
      "schema": {
        "type": "object",
        "properties": {
          "tweet": {
            "type": "string",
            "description": "tweet content"
          }
        },
        "additionalProperties": false,
        "required": [ "tweet" ]
      }
    }
  end
end
