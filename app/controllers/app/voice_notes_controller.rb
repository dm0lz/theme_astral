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

      # Validate content type
      allowed_types = [
        'audio/webm', 
        'audio/webm;codecs=opus',
        'audio/wav', 
        'audio/mp3', 
        'audio/m4a',
        'audio/mp4',
        'audio/aac',
        'audio/mpeg',
        'audio/ogg',
        'application/octet-stream'
      ]
      
      unless allowed_types.include?(audio_file.content_type)
        render json: { success: false, error: "Unsupported audio format: #{audio_file.content_type}" }
        return
      end

      # Determine file extension
      file_extension = case audio_file.content_type
                      when 'audio/mp4'
                        '.mp4'
                      when 'audio/wav'
                        '.wav'
                      when 'audio/m4a'
                        '.m4a'
                      when 'audio/aac'
                        '.aac'
                      when 'audio/mp3', 'audio/mpeg'
                        '.mp3'
                      when 'audio/webm', 'audio/webm;codecs=opus'
                        '.webm'
                      when 'audio/ogg'
                        '.ogg'
                      else
                        '.mp3' # Default fallback
                      end

      # Create temporary file
      temp_file = Tempfile.new(['voice_note', file_extension])
      temp_file.binmode
      temp_file.write(audio_file.read)
      temp_file.rewind

      # Initialize OpenAI client
      client = OpenAI::Client.new(access_token: Rails.application.credentials.openai_api_key)

      # Make the transcription request
      response = client.audio.transcribe(
        parameters: {
          model: "whisper-1",
          file: File.open(temp_file.path, 'rb')
        }
      )

      transcription = response.dig("text")
      
      if transcription.present?
        render json: { 
          success: true, 
          transcription: transcription.strip
        }
      else
        render json: { success: false, error: "Transcription returned empty result" }
      end

    rescue OpenAI::Error => e
      Rails.logger.error "OpenAI API error: #{e.class} - #{e.message}"
      
      error_message = case e.message
                      when /Invalid file format/i
                        "Audio format not supported. Please try recording again."
                      when /File too large/i
                        "Audio file too large. Please record a shorter message."
                      when /rate limit/i
                        "Service temporarily busy. Please try again in a moment."
                      else
                        "Transcription service temporarily unavailable. Please try again."
                      end
                      
      render json: { success: false, error: error_message }
    rescue => e
      Rails.logger.error "Voice transcription error: #{e.class} - #{e.message}"
      render json: { success: false, error: "An error occurred while processing your voice note. Please try again." }
    ensure
      # Clean up temporary file
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