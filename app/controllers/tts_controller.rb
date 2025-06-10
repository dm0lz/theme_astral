class TtsController < ApplicationController
  protect_from_forgery with: :null_session

  def speak
    text_param = params[:text].to_s.strip
    return head :bad_request if text_param.blank?

    begin
      audio_data = Ai::Openai::TtsService.new(text: text_param).call

      send_data audio_data,
                filename: "speech.mp3",
                type: "audio/mpeg",
                disposition: "inline"
    rescue StandardError => e
      Rails.logger.error "TTS Controller Error: #{e.message}"
      
      # Return a meaningful error response
      render json: { 
        error: "TTS service temporarily unavailable", 
        message: "Please try again in a moment" 
      }, status: :service_unavailable
    end
  end
end 