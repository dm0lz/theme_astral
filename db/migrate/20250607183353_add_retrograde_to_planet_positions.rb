class AddRetrogradeToPlanetPositions < ActiveRecord::Migration[8.0]
  def change
    add_column :planet_positions, :retrograde, :boolean
  end
end
