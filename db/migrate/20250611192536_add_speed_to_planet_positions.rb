class AddSpeedToPlanetPositions < ActiveRecord::Migration[8.0]
  def change
    add_column :planet_positions, :speed, :decimal, precision: 10, scale: 7
  end
end
