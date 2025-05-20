class Social::X::PublisherService < BaseService
  def initialize
    @x_credentials = {
      api_key: Rails.application.credentials[:x_api_key],
      api_key_secret: Rails.application.credentials[:x_api_key_secret],
      access_token: Rails.application.credentials[:x_access_token],
      access_token_secret: Rails.application.credentials[:x_access_token_secret],
      bearer_token: Rails.application.credentials[:x_bearer_token]
    }
    @x_client = X::Client.new(**@x_credentials)
  end
  attr_reader :x_client

  def call
    topic = Ai::Seo::KeywordsService.new.keywords.sample
    tweet = Social::X::TweetGeneratorService.new(topic).call
    @x_client.post("tweets", %Q({"text": "#{tweet}"}))
  end
end
