class Keyword < ApplicationRecord
  after_create :create_seo_page
  after_create :create_long_tail_seo_keywords, unless: :is_long_tail?

  validates :name, presence: true, uniqueness: true

  private

  def create_seo_page
    CreateSeoPageJob.perform_later(self.id)
  end

  def create_long_tail_seo_keywords
    Ai::Seo::LongTailKeywordsService.new.call(self.id)
  end
end
