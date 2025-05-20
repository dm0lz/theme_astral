class Ai::Openai::EmbeddingService < BaseService
  def initialize(text)
    @text = text
  end

  def call
    client = OpenAI::Client.new
    response = client.embeddings(
      parameters: {
        model: "jeffh/intfloat-multilingual-e5-large-instruct:f16",
        input: @text
      }
    )
    response["data"][0]["embedding"]
  end
end
