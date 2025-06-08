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

      # Log detailed info about the incoming file
      Rails.logger.info "Received audio file: #{audio_file.original_filename}"
      Rails.logger.info "Content type: #{audio_file.content_type}"
      Rails.logger.info "File size: #{audio_file.size} bytes"

      # Validate content type - support iOS formats
      allowed_types = [
        'audio/webm', 
        'audio/wav', 
        'audio/mp3', 
        'audio/m4a',     # iOS format
        'audio/mp4',     # iOS format
        'audio/aac',     # iOS format
        'audio/mpeg',    # Alternative MP3
        'audio/ogg',     # OGG format
        'application/octet-stream' # fallback for mobile uploads
      ]
      
      unless allowed_types.include?(audio_file.content_type)
        Rails.logger.warn "Unsupported audio format: #{audio_file.content_type}"
        # Don't reject - iOS sometimes sends generic content types
      end

      # For iOS MP4/M4A files, we need to use a more compatible extension
      # Whisper prefers certain formats over others
      file_extension = case audio_file.content_type
                      when 'audio/mp4', 'audio/m4a'
                        '.mp3'  # Convert iOS MP4 to MP3 extension for better Whisper compatibility
                      when 'audio/aac'
                        '.mp3'  # Convert AAC to MP3 extension as well
                      when 'audio/wav'
                        '.wav'
                      when 'audio/mp3', 'audio/mpeg'
                        '.mp3'
                      when 'audio/ogg'
                        '.ogg'
                      else
                        # For unknown types, try MP3 extension (most compatible)
                        '.mp3'
                      end

      Rails.logger.info "Using file extension: #{file_extension}"

      temp_file = Tempfile.new(['voice_note', file_extension])
      temp_file.binmode
      temp_file.write(audio_file.read)
      temp_file.rewind

      Rails.logger.info "Created temporary file: #{temp_file.path} (#{File.size(temp_file.path)} bytes)"

      # Initialize OpenAI client
      client = OpenAI::Client.new(access_token: Rails.application.credentials.openai_api_key)

      # Make the transcription request with better error handling
      Rails.logger.info "Sending file to Whisper API..."
      
      response = client.audio.transcribe(
        parameters: {
          model: "whisper-1",
          file: File.open(temp_file.path, 'rb'),
          language: "fr"
        }
      )

      Rails.logger.info "Whisper API response received"
      transcription = response.dig("text")
      
      if transcription.present?
        Rails.logger.info "Transcription successful: #{transcription[0..100]}..."
        render json: { 
          success: true, 
          transcription: transcription.strip,
          audio_info: {
            original_format: audio_file.content_type,
            processed_extension: file_extension,
            size: audio_file.size,
            duration_estimate: "#{(audio_file.size / 16000.0).round(1)}s"
          }
        }
      else
        Rails.logger.error "Transcription returned empty result"
        render json: { success: false, error: "Transcription returned empty result" }
      end

    rescue OpenAI::Error => e
      Rails.logger.error "OpenAI API error: #{e.class} - #{e.message}"
      
      # More specific error messages for different OpenAI errors
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
      Rails.logger.error e.backtrace.join("\n")
      render json: { success: false, error: "An error occurred while processing your voice note. Please try again." }
    ensure
      # Ensure temporary file is cleaned up even if there's an error
      if temp_file
        begin
          temp_file.close unless temp_file.closed?
          temp_file.unlink if File.exist?(temp_file.path)
          Rails.logger.info "Temporary file cleaned up successfully"
        rescue => cleanup_error
          Rails.logger.error "Error cleaning up temp file: #{cleanup_error.message}"
        end
      end
    end
  end
end 