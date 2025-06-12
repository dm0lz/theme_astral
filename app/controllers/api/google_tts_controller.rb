class Api::GoogleTtsController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:synthesize]
  before_action :require_authentication

  def synthesize
    text = params[:text]
    voice = params[:voice] || 'en-US-Neural2-A'
    speed = params[:speed]&.to_f || 1.0

    if text.blank?
      render json: { error: 'Text parameter is required' }, status: :bad_request
      return
    end

    if text.length > 5000
      render json: { error: 'Text too long (max 5000 characters)' }, status: :bad_request
      return
    end

    begin
      audio_content = synthesize_speech(text, voice, speed)
      
      send_data audio_content,
                type: 'audio/mpeg',
                disposition: 'inline',
                filename: 'tts_audio.mp3'
                
    rescue => e
      Rails.logger.error "Google TTS error: #{e.message}"
      render json: { error: 'Speech synthesis failed' }, status: :internal_server_error
    end
  end

  private

  def synthesize_speech(text, voice, speed)
    require 'net/http'
    require 'json'
    require 'base64'

    # Google Cloud TTS API endpoint
    api_key = Rails.application.credentials.dig(:google, :tts_api_key)
    
    if api_key.blank?
      Rails.logger.error "Google TTS API key not found in credentials"
      Rails.logger.error "Available credential keys: #{Rails.application.credentials.to_h.keys}"
      raise "Google TTS API key not configured"
    end

    url = URI("https://texttospeech.googleapis.com/v1/text:synthesize?key=#{api_key}")
    
    # Parse voice components
    voice_parts = voice.split('-')
    language_code = "#{voice_parts[0]}-#{voice_parts[1]}" # e.g., "en-US"
    voice_name = voice

    request_body = {
      input: { text: text },
      voice: {
        languageCode: language_code,
        name: voice_name
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: speed.clamp(0.25, 4.0),
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    }

    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(url)
    request['Content-Type'] = 'application/json'
    request.body = request_body.to_json

    response = http.request(request)

    if response.code == '200'
      result = JSON.parse(response.body)
      audio_content = result['audioContent']
      
      if audio_content.present?
        Base64.decode64(audio_content)
      else
        raise "No audio content received from Google TTS"
      end
    else
      error_data = JSON.parse(response.body) rescue {}
      error_message = error_data.dig('error', 'message') || 'Unknown error'
      raise "Google TTS API error (#{response.code}): #{error_message}"
    end
  end
end 