class App::VoiceNotesController < App::ApplicationController
  def transcribe
    begin
      # Check if audio file is present
      unless params[:audio].present?
        render json: { success: false, error: "No audio file provided" }
        return
      end

      audio_file = params[:audio]
      
      # Validate file size (max 25MB for Whisper API)
      max_size = 25.megabytes
      if audio_file.size > max_size
        render json: { success: false, error: "Audio file too large. Maximum size is 25MB." }
        return
      end

      # Validate content type - support iOS formats
      allowed_types = [
        'audio/webm', 
        'audio/wav', 
        'audio/mp3', 
        'audio/m4a',     # iOS format
        'audio/mp4',     # iOS format
        'audio/aac',     # iOS format
        'application/octet-stream' # fallback for mobile uploads
      ]
      
      unless allowed_types.include?(audio_file.content_type)
        Rails.logger.warn "Unsupported audio format: #{audio_file.content_type}"
        # Don't reject - iOS sometimes sends generic content types
      end

      # Create a temporary file with appropriate extension
      file_extension = case audio_file.content_type
                      when 'audio/mp4', 'audio/m4a'
                        '.m4a'
                      when 'audio/aac'
                        '.aac'
                      when 'audio/wav'
                        '.wav'
                      when 'audio/mp3'
                        '.mp3'
                      else
                        # Default to webm, but Whisper can handle many formats
                        '.webm'
                      end

      temp_file = Tempfile.new(['voice_note', file_extension])
      temp_file.binmode
      temp_file.write(audio_file.read)
      temp_file.rewind

      Rails.logger.info "Processing audio file: #{audio_file.original_filename} (#{audio_file.content_type}, #{audio_file.size} bytes)"

      # Initialize OpenAI client
      client = OpenAI::Client.new(access_token: Rails.application.credentials.openai_api_key)

      # Make the transcription request
      response = client.audio.transcribe(
        parameters: {
          model: "whisper-1",
          file: File.open(temp_file.path, 'rb'),
          language: "en" # Optional: remove to auto-detect language
        }
      )

      transcription = response.dig("text")
      
      if transcription.present?
        Rails.logger.info "Transcription successful: #{transcription[0..100]}..."
        render json: { 
          success: true, 
          transcription: transcription.strip,
          audio_info: {
            format: audio_file.content_type,
            size: audio_file.size,
            duration_estimate: "#{(audio_file.size / 16000.0).round(1)}s" # rough estimate
          }
        }
      else
        render json: { success: false, error: "Transcription returned empty result" }
      end

    rescue OpenAI::Error => e
      Rails.logger.error "OpenAI API error: #{e.message}"
      render json: { success: false, error: "Transcription service temporarily unavailable. Please try again." }
    rescue => e
      Rails.logger.error "Voice transcription error: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      render json: { success: false, error: "An error occurred while processing your voice note. Please try again." }
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