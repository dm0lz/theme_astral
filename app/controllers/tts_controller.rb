class TtsController < ApplicationController
  protect_from_forgery with: :null_session

  def speak
    text_param = params[:text].to_s.strip
    return head :bad_request if text_param.blank?

    Rails.logger.info "TTS Controller: Processing request for text length: #{text_param.length}"

    begin
      start_time = Time.current
      audio_data = Ai::Openai::TtsService.new(text: text_param).call
      duration = ((Time.current - start_time) * 1000).round(2)
      
      Rails.logger.info "TTS Controller: Successfully generated audio in #{duration}ms"

      send_data audio_data,
                filename: "speech.mp3",
                type: "audio/mpeg",
                disposition: "inline"
    rescue Net::ReadTimeout => e
      Rails.logger.error "TTS Controller: Network read timeout - #{e.message}"
      render json: { 
        error: "TTS network timeout", 
        message: "Request took too long, please try again" 
      }, status: :request_timeout
    rescue Timeout::Error => e
      Rails.logger.error "TTS Controller: Timeout - #{e.message}"
      render json: { 
        error: "TTS timeout", 
        message: "Request timed out, please try again" 
      }, status: :request_timeout
    rescue StandardError => e
      Rails.logger.error "TTS Controller Error: #{e.class.name} - #{e.message}"
      Rails.logger.error "TTS Controller Backtrace: #{e.backtrace.first(3).join(', ')}"
      
      # Return a meaningful error response
      render json: { 
        error: "TTS service temporarily unavailable", 
        message: "Please try again in a moment" 
      }, status: :service_unavailable
    end
  end
end 