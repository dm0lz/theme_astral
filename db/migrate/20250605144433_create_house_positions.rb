class CreateHousePositions < ActiveRecord::Migration[8.0]
  def change
    create_table :house_positions do |t|
      t.references :birth_chart, null: false, foreign_key: true
      t.integer :house
      t.float :longitude
      t.string :zodiac

      t.timestamps
    end
  end
end
