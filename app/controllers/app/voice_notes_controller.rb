class App::VoiceNotesController < App::ApplicationController
  def transcribe
    unless params[:audio].present?
      render json: { error: 'No audio file provided' }, status: :bad_request
      return
    end

    begin
      # Check if OpenAI is configured
      unless Rails.application.credentials.openai_api_key
        render json: { error: 'OpenAI API key not configured' }, status: :service_unavailable
        return
      end

      # Initialize OpenAI client (uses global configuration)
      client = OpenAI::Client.new(access_token: Rails.application.credentials.openai_api_key)

      # Prepare the audio file
      audio_file = params[:audio]
      
      # Create a temporary file to work with the audio data
      temp_file = Tempfile.new(['voice_note', '.webm'])
      temp_file.binmode
      temp_file.write(audio_file.read)
      temp_file.rewind

      # Make the transcription request
      response = client.audio.transcribe(
        parameters: {
          model: "whisper-1",
          file: File.open(temp_file.path, 'rb'),
          # language: "en" # Optional: remove to auto-detect language
        }
      )

      # Clean up temporary file
      temp_file.close
      temp_file.unlink

      if response && response["text"]
        render json: { 
          transcription: response["text"],
          success: true 
        }
      else
        Rails.logger.error "Whisper API unexpected response: #{response.inspect}"
        render json: { 
          error: 'Failed to transcribe audio. Please try again.',
          success: false 
        }, status: :unprocessable_entity
      end
      
    rescue OpenAI::Error => e
      Rails.logger.error "OpenAI API error: #{e.message}"
      render json: { 
        error: 'OpenAI service error. Please try again later.',
        success: false 
      }, status: :unprocessable_entity
    rescue StandardError => e
      Rails.logger.error "Voice transcription error: #{e.message}"
      render json: { 
        error: 'An error occurred while processing your voice note. Please try again.',
        success: false 
      }, status: :internal_server_error
    ensure
      # Ensure temporary file is cleaned up even if there's an error
      if temp_file
        begin
          temp_file.close unless temp_file.closed?
          temp_file.unlink if File.exist?(temp_file.path)
        rescue => cleanup_error
          Rails.logger.error "Error cleaning up temp file: #{cleanup_error.message}"
        end
      end
    end
  end
end 