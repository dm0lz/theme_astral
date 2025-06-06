class Notebook < ApplicationRecord
  belongs_to :user
  has_many :notes, dependent: :destroy
  
  validates :title, presence: { message: "Notebook title cannot be blank" },
                    length: { minimum: 3, maximum: 255,
                             too_short: "Notebook title must be at least 3 characters long",
                             too_long: "Notebook title cannot exceed 255 characters" }
  
end
