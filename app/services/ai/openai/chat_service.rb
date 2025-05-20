class Ai::Openai::ChatService < BaseService
  def call(user_prompt, response_schema)
    client = OpenAI::Client.new(request_timeout: 900)
    response = client.chat(
      parameters: {
        model: "custom-deepseek-r1:latest",
        # response_format: { type: "json_object" },
        response_format: {
          type: "json_schema",
          json_schema: response_schema
        },
        messages: [
          { role: "system", content: system_prompt },
          { role: "user", content: user_prompt.truncate(100000) }
        ],
        temperature: 0.2
      }
    )
    JSON.parse(response["choices"][0]["message"]["content"].match(/{.*}/m).to_s) rescue nil
  end

  private
  def system_prompt
    <<-PROMPT
      You are a business intelligence expert specialized in analyzing companies and markets.
      Your task is to extract and analyze company information from web content.

      Guidelines:
      - Provide factual information only from the content provided
      - Do not make assumptions or invent information
      - State "Information not available" when data cannot be found
      - Focus on business-relevant details like company structure, products, market position
      - Return responses in the exact JSON format specified in the schema
      - Be precise and concise in your analysis

      You will receive:
      1. Content to analyze
      2. JSON schema for response format
    PROMPT
  end
end
