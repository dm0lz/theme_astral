class Ai::SerpDomainFinderService < BaseService
  def call(serp)
    response = Ai::Openai::ChatService.new.call(user_prompt(serp), response_schema)
    response["company_domain"].strip
  end

  private
  def user_prompt(serp)
    <<-TXT
      Given the company name #{serp.first["query"]} and the following search results, extract the most likely official domain name.
      Search engine results : #{serp.to_json}
    TXT
  end

  def response_schema
    {
      "strict": true,
      "name": "company domain extractor",
      "description": "extract the most likely official domain name",
      "schema": {
        "type": "object",
        "properties": {
          "company_domain": {
            "type": "string",
            "description": "the domain name of the company (must be a valid domain name)"
          }
        },
        "additionalProperties": false,
        "required": [ "company_domain" ]
      }
    }
  end
end
