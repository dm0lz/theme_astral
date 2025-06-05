class HousePosition < ApplicationRecord
  belongs_to :birth_chart
  validates :house, presence: true, inclusion: { in: 1..12 }
end
