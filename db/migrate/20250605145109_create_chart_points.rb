class CreateChartPoints < ActiveRecord::Migration[8.0]
  def change
    create_table :chart_points do |t|
      t.references :birth_chart, null: false, foreign_key: true
      t.string :name
      t.float :longitude
      t.string :zodiac

      t.timestamps
    end
  end
end
