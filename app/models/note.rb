class Note < ApplicationRecord
  belongs_to :user
  belongs_to :notebook

  validates :body, presence: { message: "Note content cannot be blank" },
                   length: { minimum: 3, too_short: "Note content must be at least 3 characters long" }
  
  validates :notebook, presence: { message: "Please select a notebook for this note" }

end
