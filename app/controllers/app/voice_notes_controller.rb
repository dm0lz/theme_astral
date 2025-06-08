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

      # Detect device type from both user agent and frontend data
      user_agent = request.user_agent.to_s
      device_type = params[:device_type] # from frontend
      frontend_is_ios = params[:is_ios] == 'true'
      
      # Prefer frontend detection as it's more accurate
      is_ipad = device_type == 'ipad' || user_agent.include?('iPad')
      is_iphone = device_type == 'iphone' || user_agent.include?('iPhone')
      is_ios = frontend_is_ios || is_ipad || is_iphone
      
      Rails.logger.info "Device detection: iPad=#{is_ipad}, iPhone=#{is_iphone}, iOS=#{is_ios}"
      Rails.logger.info "Frontend device type: #{device_type}, iOS: #{frontend_is_ios}"
      Rails.logger.info "User agent: #{user_agent}"
      Rails.logger.info "Audio info: MIME=#{params[:mime_type]}, Size=#{params[:file_size]} bytes"

      # Initialize OpenAI client
      client = OpenAI::Client.new(access_token: Rails.application.credentials.openai_api_key)

      # Make the transcription request with device-optimized parameters
      Rails.logger.info "Sending file to Whisper API..."
      
      # Build Whisper API parameters with device-optimized parameters
      whisper_params = {
        model: "whisper-1",  # Only valid model for OpenAI Whisper API
        file: File.open(temp_file.path, 'rb')
      }
      
      # Add general quality improvements for iPad without forcing language
      if is_ipad
        # iPad tends to have audio quality issues, use lower temperature for more consistent results
        whisper_params[:temperature] = 0.1  # Very low for maximum consistency on iPad
        Rails.logger.info "Using very low temperature (0.1) for iPad audio quality issues"
      elsif is_ios
        # Other iOS devices get moderate temperature adjustment
        whisper_params[:temperature] = 0.2  # Lower temperature for more consistent results
        Rails.logger.info "Using lower temperature (0.2) for iOS device"
      end
      
      response = client.audio.transcribe(parameters: whisper_params)

      Rails.logger.info "Whisper API response received"
      transcription = response.dig("text")
      
      if transcription.present?
        Rails.logger.info "Transcription successful: #{transcription[0..100]}..."
        Rails.logger.info "iPad audio quality optimizations applied: #{is_ipad}" if is_ipad
        render json: { 
          success: true, 
          transcription: transcription.strip,
          audio_info: {
            original_format: audio_file.content_type,
            processed_extension: file_extension,
            size: audio_file.size,
            duration_estimate: "#{(audio_file.size / 16000.0).round(1)}s",
            device_type: device_type,
            optimizations_applied: is_ipad ? "very low temperature (0.1) for audio quality" : (is_ios ? "lower temperature (0.2)" : "none")
          }
        }
      else
        Rails.logger.error "Transcription returned empty result"
        Rails.logger.error "iPad device detected with audio quality issues: #{is_ipad}" if is_ipad
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