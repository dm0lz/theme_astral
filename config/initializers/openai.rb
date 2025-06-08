# OpenAI Configuration
OpenAI.configure do |config|
  config.access_token = Rails.application.credentials.openai_api_key
  config.log_errors = Rails.env.development? # Only log errors in development
end 