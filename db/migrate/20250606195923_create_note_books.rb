class CreateNoteBooks < ActiveRecord::Migration[8.0]
  def change
    create_table :notebooks do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title
      t.text :description

      t.timestamps
    end
  end
end
