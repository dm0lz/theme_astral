class SeoPage < ApplicationRecord
  belongs_to :keyword
  validates :slug, :meta_title, :meta_description, :headline, :subheading, :content, presence: true
  validates :slug, uniqueness: true
end
