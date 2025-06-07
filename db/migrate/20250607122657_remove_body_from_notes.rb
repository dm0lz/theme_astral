class RemoveBodyFromNotes < ActiveRecord::Migration[8.0]
  def change
    remove_column :notes, :body, :text
  end
end
