class RemoveDescriptionFromNotebooks < ActiveRecord::Migration[8.0]
  def change
    remove_column :notebooks, :description, :text
  end
end
