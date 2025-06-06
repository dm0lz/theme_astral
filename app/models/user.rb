class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :birth_charts, dependent: :destroy
  has_many :chat_messages, dependent: :destroy
  has_many :notebooks, dependent: :destroy
  has_many :notes, through: :notebooks

  normalizes :email_address, with: ->(e) { e.strip.downcase }
end
