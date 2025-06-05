class AddUserIdToBirthCharts < ActiveRecord::Migration[8.0]
  def change
    add_reference :birth_charts, :user, null: false, foreign_key: true
  end
end
