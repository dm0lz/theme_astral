class ChartPoint < ApplicationRecord
  belongs_to :birth_chart
  validates :name, presence: true, inclusion: { in: %w[Ascendant MC Vertex ARMC EquatAsc CoAscWK CoAscM PolarAsc PartOfFortune] }
end
