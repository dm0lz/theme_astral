class Social::X::MassPublisherService < BaseService
  def call(search, topic)
    payload = Social::X::TweetGeneratorService.new(topic).call
    logger.info(payload)
    Social::X::TweetsReplierService.new(search, payload).call
  end
end
