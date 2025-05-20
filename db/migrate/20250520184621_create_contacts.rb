class CreateContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :contacts do |t|
      t.string :name
      t.string :email
      t.string :consultation_type
      t.datetime :birth_datetime
      t.string :birthplace
      t.datetime :consultation_datetime
      t.text :message

      t.timestamps
    end
  end
end
