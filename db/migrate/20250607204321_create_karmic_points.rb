class CreateKarmicPoints < ActiveRecord::Migration[8.0]
  def change
    create_table :karmic_points do |t|
      t.references :birth_chart, null: false, foreign_key: true
      t.string :name, null: false # NorthNode, SouthNode, Chiron, Lilith
      t.decimal :longitude, precision: 10, scale: 7, null: false
      t.string :zodiac
      t.decimal :speed, precision: 10, scale: 7
      t.boolean :retrograde, default: false
      t.timestamps
    end

    add_index :karmic_points, [:birth_chart_id, :name], unique: true
  end
end
