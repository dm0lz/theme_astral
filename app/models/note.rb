class Note < ApplicationRecord
  belongs_to :notebook

  validates :body, presence: { message: "Note content cannot be blank" },
                   length: { minimum: 3, maximum: 10000, 
                            too_short: "Note content must be at least 3 characters long",
                            too_long: "Note content cannot exceed 10,000 characters" }
  
  validates :notebook, presence: { message: "Please select a notebook for this note" }

  # Custom validation to ensure the note belongs to a valid notebook
  validate :notebook_belongs_to_user, if: :notebook

  private

  def notebook_belongs_to_user
    return unless notebook&.user_id && notebook.user != Current.user
    
    errors.add(:notebook, "Selected notebook is not accessible")
  end
end
