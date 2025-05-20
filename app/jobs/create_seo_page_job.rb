class CreateSeoPageJob < ApplicationJob
  queue_as :default

  def perform(keyword_id)
    keyword = Keyword.find(keyword_id)
    return if SeoPage.exists?(keyword: keyword)
    seo_page = Ai::Seo::PageService.new.call(keyword.name, keyword.pillar)
    SeoPage.create!(
      keyword: keyword,
      slug: keyword.name.parameterize,
      meta_title: seo_page["meta_title"],
      meta_description: seo_page["meta_description"],
      headline: seo_page["headline"],
      subheading: seo_page["subheading"],
      content: seo_page["content"],
      pillar: keyword.pillar ? keyword.pillar.parameterize : nil
    )
  end
end
 