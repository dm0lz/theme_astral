class SerpAnalyzerService < BaseService
  def initialize(search_engine: "duckduckgo", pages_number: 10, query:)
    @search_engine = search_engine
    @pages_number = pages_number
    @query = query
  end

  def call(prompt)
    serp = SearchEngine::QueryService.new(search_engine: @search_engine, pages_number: @pages_number).call(@query)
    response = Ai::Openai::ChatService.new.call(user_prompt(prompt, serp), response_schema)
    response["analysis"].strip
  end

  private
  def user_prompt(prompt, serp)
    <<-TXT
      Given the following prompt : #{prompt}
      Analyze the following search engine results : #{serp.to_json}
    TXT
  end

  def response_schema
    {
      "strict": true,
      "name": "Search engine results analyzer",
      "description": "Analyzes the content of search engine results",
      "schema": {
        "type": "object",
        "properties": {
          "analysis": {
            "type": "string",
            "description": "the response to the prompt"
          }
        },
        "additionalProperties": false,
        "required": [ "analysis" ]
      }
    }
  end
end
