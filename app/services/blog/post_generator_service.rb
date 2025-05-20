class Blog::PostGeneratorService < BaseService
  def call(topic)
    Ai::Openai::ChatService.new.call(user_prompt(topic), response_schema)
  end

  private
  def user_prompt(topic)
    <<-TXT
      Generate a blog Post about the following topic : #{topic}
    TXT
  end

  def response_schema
    {
      "strict": true,
      "name": "Blog Post Generator",
      "description": "Generate a blog post",
      "schema": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "description": "the title of the blog post"
          },
          "body": {
            "type": "string",
            "description": "the body of the blog post"
          }
        },
        "additionalProperties": false,
        "required": [ "title", "body" ]
      }
    }
  end
end
