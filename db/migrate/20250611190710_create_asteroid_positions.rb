class CreateAsteroidPositions < ActiveRecord::Migration[8.0]
  def change
    create_table :asteroid_positions do |t|
      t.references :birth_chart, null: false, foreign_key: true
      t.string :name, null: false # Pallas, Vesta, Juno, Ceres
      t.decimal :longitude, precision: 10, scale: 7, null: false
      t.string :zodiac
      t.decimal :speed, precision: 10, scale: 7
      t.boolean :retrograde, default: false
      t.timestamps
    end

    add_index :asteroid_positions, [:birth_chart_id, :name], unique: true
  end
end
