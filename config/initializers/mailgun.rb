Mailgun.configure do |config|
  config.api_key = Rails.application.credentials.mailgun_api_key
end