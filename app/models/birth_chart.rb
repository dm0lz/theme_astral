class BirthChart < ApplicationRecord
  has_many :planet_positions, dependent: :destroy
  has_many :house_positions, dependent: :destroy
  has_many :chart_points, dependent: :destroy
  has_many :karmic_points, dependent: :destroy
  has_many :asteroid_positions, dependent: :destroy
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
    ephemeris_data = SwissEphemerisService.new(self).call
    
    # Create planet positions
    ephemeris_data[:planets].each do |planet_data|
      planet_positions.create!(
        planet: planet_data[:planet],
        longitude: planet_data[:longitude],
        zodiac: planet_data[:zodiac],
        speed: planet_data[:speed],
        retrograde: planet_data[:retrograde]
      )
    end
    
    # Create house positions
    ephemeris_data[:houses].each do |house_data|
      house_positions.create!(
        house: house_data[:house],
        longitude: house_data[:longitude],
        zodiac: house_data[:zodiac]
      )
    end
    
    # Create chart points
    ephemeris_data[:chart_points].each do |chart_point_data|
      chart_points.create!(
        name: chart_point_data[:name],
        longitude: chart_point_data[:longitude],
        zodiac: chart_point_data[:zodiac]
      )
    end
    
    # Create karmic points
    ephemeris_data[:karmic_points].each do |karmic_point_data|
      karmic_points.create!(
        name: karmic_point_data[:name],
        longitude: karmic_point_data[:longitude],
        zodiac: karmic_point_data[:zodiac],
        speed: karmic_point_data[:speed],
        retrograde: karmic_point_data[:retrograde]
      )
    end
    
    # Create asteroid positions
    ephemeris_data[:asteroids].each do |asteroid_data|
      asteroid_positions.create!(
        name: asteroid_data[:asteroid],
        longitude: asteroid_data[:longitude],
        zodiac: asteroid_data[:zodiac],
        speed: asteroid_data[:speed],
        retrograde: asteroid_data[:retrograde]
      )
    end
  end
end
