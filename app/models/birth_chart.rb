class BirthChart < ApplicationRecord
  has_many :planet_positions, dependent: :destroy
  has_many :house_positions, dependent: :destroy
  has_many :chart_points, dependent: :destroy
  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :birth, presence: true
  validates :city, presence: true
  validates :country, presence: true
  geocoded_by :location
  after_validation :geocode, if: ->(obj){ obj.city_changed? || obj.country_changed? }
  after_create_commit :calculate_positions

  def location
    [city, country].compact.join(', ')
  end

  private

  def calculate_positions
    planet_positions = SwissEphemerisService.new(self).call
    planet_positions[:planets].each do |planet_position|
      self.planet_positions.create(
        planet: planet_position[:planet],
        longitude: planet_position[:longitude],
        zodiac: planet_position[:zodiac],
        retrograde: planet_position[:retrograde]
      )
    end
    planet_positions[:houses].each do |house_position|
      self.house_positions.create(
        house: house_position[:house],
        longitude: house_position[:longitude],
        zodiac: house_position[:zodiac]
      )
    end
    planet_positions[:chart_points].each do |chart_point|
      self.chart_points.create(
        name: chart_point[:name],
        longitude: chart_point[:longitude],
        zodiac: chart_point[:zodiac]
      )
    end
  end
end
