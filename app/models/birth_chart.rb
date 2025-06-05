class BirthChart < ApplicationRecord
  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :birth, presence: true
  validates :city, presence: true
  validates :country, presence: true
  geocoded_by :location
  after_validation :geocode, if: ->(obj){ obj.city_changed? || obj.country_changed? }

  def location
    [city, country].compact.join(', ')
  end
end
