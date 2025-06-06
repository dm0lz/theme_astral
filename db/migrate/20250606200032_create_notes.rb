class CreateNotes < ActiveRecord::Migration[8.0]
  def change
    create_table :notes do |t|
      t.references :notebook, null: false, foreign_key: true
      t.text :body

      t.timestamps
    end
  end
end
