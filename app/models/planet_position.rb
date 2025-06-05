class PlanetPosition < ApplicationRecord
  belongs_to :birth_chart
  validates :planet, presence: true, inclusion: { in: SwissEphemerisService::PLANETS }
end
