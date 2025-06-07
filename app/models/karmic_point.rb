class KarmicPoint < ApplicationRecord
  belongs_to :birth_chart
  
  validates :name, presence: true, inclusion: { 
    in: %w[NorthNode SouthNode Chiron Lilith],
    message: "%{value} is not a valid karmic point" 
  }
  validates :longitude, presence: true, 
    numericality: { greater_than_or_equal_to: 0, less_than: 360 }
  validates :name, uniqueness: { scope: :birth_chart_id }

  scope :north_node, -> { where(name: 'NorthNode') }
  scope :south_node, -> { where(name: 'SouthNode') }
  scope :chiron, -> { where(name: 'Chiron') }
  scope :lilith, -> { where(name: 'Lilith') }
end 