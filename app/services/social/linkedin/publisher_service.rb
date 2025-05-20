class Social::Linkedin::PublisherService < BaseService
  def call
    topic = Ai::Seo::KeywordsService.new.keywords.sample
    post = Social::Linkedin::PostGeneratorService.new(topic).call
    Social::Linkedin::PostService.new.call(post)
  end
end
