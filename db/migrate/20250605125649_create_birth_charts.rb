class CreateBirthCharts < ActiveRecord::Migration[8.0]
  def change
    create_table :birth_charts do |t|
      t.datetime :birth
      t.float :latitude
      t.float :longitude
      t.string :first_name
      t.string :last_name
      t.string :city
      t.string :country

      t.timestamps
    end
  end
end
