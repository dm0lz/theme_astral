class Blog::PostCreatorService < BaseService
  def call(topic)
    post = Blog::PostGeneratorService.new.call(topic)
    Post.create!(title: post["title"].downcase, body: post["body"])
  end
end
