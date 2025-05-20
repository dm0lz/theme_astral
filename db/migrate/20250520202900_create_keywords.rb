class CreateKeywords < ActiveRecord::Migration[8.0]
  def change
    create_table :keywords do |t|
      t.string :name
      t.boolean :is_long_tail
      t.string :pillar

      t.timestamps
    end

    add_index :keywords, :name, unique: true
    add_index :keywords, :pillar
  end
end
