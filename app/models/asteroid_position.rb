class AsteroidPosition < ApplicationRecord
  belongs_to :birth_chart
  
  validates :name, presence: true, inclusion: { 
    in: %w[Ceres Pallas Juno Vesta Astraea Eros],
    message: "%{value} is not a valid asteroid" 
  }
  validates :longitude, presence: true, 
    numericality: { greater_than_or_equal_to: 0, less_than: 360 }
  validates :name, uniqueness: { scope: :birth_chart_id }

  scope :ceres, -> { where(name: 'Ceres') }
  scope :pallas, -> { where(name: 'Pallas') }
  scope :juno, -> { where(name: 'Juno') }
  scope :vesta, -> { where(name: 'Vesta') }
  scope :astraea, -> { where(name: 'Astraea') }
  scope :eros, -> { where(name: 'Eros') }
end
