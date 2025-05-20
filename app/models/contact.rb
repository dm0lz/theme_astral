class Contact < ApplicationRecord
  validates :name, :email, :birth_datetime, :birthplace, :consultation_datetime, :consultation_type, presence: true
  validates :message, length: { minimum: 50, message: "doit contenir au moins 50 caractères" }
end
