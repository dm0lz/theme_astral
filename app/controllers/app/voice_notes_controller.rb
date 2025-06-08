class App::VoiceNotesController < App::ApplicationController
  def transcribe
    begin
      # Check if audio file is present
      unless params[:audio].present?
        render json: { success: false, error: "No audio file provided" }
        return
      end

      audio_file = params[:audio]
      
      # Detect device type FIRST - needed for file processing decisions
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
      Rails.logger.info "Audio info: MIME=#{params[:mime_type]}, Size=#{params[:file_size]} bytes"

      # Validate content type - support iOS formats and WebM variants
      allowed_types = [
        'audio/webm', 
        'audio/webm;codecs=opus',    # Chrome WebM with Opus codec
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

      # Keep native formats for better Whisper compatibility, with iPad exception
      # iPad MediaRecorder produces MP4 with problematic codecs - convert to WAV
      file_extension = case audio_file.content_type
                      when 'audio/mp4'
                        if is_ipad
                          '.wav'  # Convert iPad MP4 to WAV for better Whisper compatibility
                        else
                          '.mp4'  # Keep non-iPad MP4 as-is
                        end
                      when 'audio/m4a'
                        '.m4a'  # Keep iPhone's native M4A format
                      when 'audio/aac'
                        '.aac'  # Keep AAC format
                      when 'audio/wav'
                        '.wav'
                      when 'audio/mp3', 'audio/mpeg'
                        '.mp3'
                      when 'audio/webm', 'audio/webm;codecs=opus'
                        '.webm'
                      when 'audio/ogg'
                        '.ogg'
                      else
                        # For unknown types, try MP3 extension (most compatible)
                        '.mp3'
                      end

      Rails.logger.info "Using file extension: #{file_extension} #{is_ipad && audio_file.content_type == 'audio/mp4' ? '(iPad MP4 -> WAV conversion)' : '(native format)'}"

      temp_file = Tempfile.new(['voice_note', file_extension])
      temp_file.binmode
      
      # Handle iPad MP4 format conversion using FFmpeg
      if is_ipad && audio_file.content_type == 'audio/mp4'
        Rails.logger.info "Converting iPad MP4 to WAV using FFmpeg for better Whisper compatibility"
        
        # Check if FFmpeg is available
        unless system('which ffmpeg > /dev/null 2>&1')
          Rails.logger.error "FFmpeg not found - required for iPad MP4 conversion"
          render json: { success: false, error: "Audio conversion tools not available. iPad MP4 format requires server-side conversion." }
          return
        end
        
        # Create temporary MP4 file first
        mp4_temp_file = Tempfile.new(['voice_note_original', '.mp4'])
        mp4_temp_file.binmode
        mp4_temp_file.write(audio_file.read)
        mp4_temp_file.rewind
        
        # Convert MP4 to WAV using FFmpeg with optimized settings for speech
        ffmpeg_command = "ffmpeg -y -i #{mp4_temp_file.path} -ar 16000 -ac 1 -sample_fmt s16 -f wav #{temp_file.path} 2>/dev/null"
        Rails.logger.info "Running FFmpeg command: #{ffmpeg_command}"
        
        system_result = system(ffmpeg_command)
        
        # Clean up the original MP4 temp file
        mp4_temp_file.close
        mp4_temp_file.unlink
        
        unless system_result
          Rails.logger.error "FFmpeg conversion failed for iPad MP4"
          render json: { success: false, error: "Audio format conversion failed. iPad Safari MP4 format is not compatible with our transcription service." }
          return
        end
        
        Rails.logger.info "Successfully converted iPad MP4 to WAV: #{File.size(temp_file.path)} bytes"
      else
        # For all other formats, write directly
        temp_file.write(audio_file.read)
      end
      
      temp_file.rewind

      Rails.logger.info "Created temporary file: #{temp_file.path} (#{File.size(temp_file.path)} bytes)"

      # iPad-specific validation and logging
      if is_ipad
        Rails.logger.info "iPad SPECIFIC PROCESSING:"
        Rails.logger.info "  - Original MIME type: #{audio_file.content_type}"
        Rails.logger.info "  - File size: #{audio_file.size} bytes"
        Rails.logger.info "  - Native file extension: #{file_extension} (no conversion - preserving original format)"
        
        # Check for potential iPad-specific issues
        if audio_file.size < 1000
          Rails.logger.warn "iPad: Very small audio file (#{audio_file.size} bytes) - may indicate recording failure"
        end
        
        if audio_file.content_type.blank? || audio_file.content_type == 'application/octet-stream'
          Rails.logger.warn "iPad: Generic or missing content type - iPad Safari MediaRecorder limitation"
        end
      end

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
        whisper_params[:temperature] = 0.0  # Absolutely lowest for maximum consistency on iPad
        # Add much stronger language hint for iPad poor audio quality
        whisper_params[:prompt] = "French vocabulary words: couleurs (bleu, vert, rouge, jaune, orange, violet), nombres, objets. Audio from iPad may have quality issues."
        Rails.logger.info "Using zero temperature (0.0) and strong French language hint for iPad audio quality issues"
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
      Rails.logger.error "iPad processing: #{is_ipad}" if defined?(is_ipad) && is_ipad
      
      # More specific error messages for different OpenAI errors
      error_message = case e.message
                      when /Invalid file format/i
                        if defined?(is_ipad) && is_ipad
                          "iPad audio format not supported. Try recording a longer message or using a different device."
                        else
                          "Audio format not supported. Please try recording again."
                        end
                      when /File too large/i
                        "Audio file too large. Please record a shorter message."
                      when /rate limit/i
                        "Service temporarily busy. Please try again in a moment."
                      else
                        if defined?(is_ipad) && is_ipad
                          "iPad transcription temporarily unavailable. This may be due to audio format limitations on iPad Safari. Please try again or use a different device."
                        else
                          "Transcription service temporarily unavailable. Please try again."
                        end
                      end
                      
      render json: { success: false, error: error_message }
    rescue => e
      Rails.logger.error "Voice transcription error: #{e.class} - #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      Rails.logger.error "iPad processing: #{is_ipad}" if defined?(is_ipad) && is_ipad
      
      error_message = if defined?(is_ipad) && is_ipad
                        "An error occurred while processing iPad audio. iPad Safari has known limitations with audio recording. Please try recording again or use Chrome browser."
                      else
                        "An error occurred while processing your voice note. Please try again."
                      end
      
      render json: { success: false, error: error_message }
    ensure
      # Ensure temporary files are cleaned up even if there's an error
      if temp_file
        begin
          temp_file.close unless temp_file.closed?
          temp_file.unlink if File.exist?(temp_file.path)
          Rails.logger.info "Temporary file cleaned up successfully"
        rescue => cleanup_error
          Rails.logger.error "Error cleaning up temp file: #{cleanup_error.message}"
        end
      end
      
      # Clean up MP4 temp file if it exists (iPad conversion)
      if defined?(mp4_temp_file) && mp4_temp_file
        begin
          mp4_temp_file.close unless mp4_temp_file.closed?
          mp4_temp_file.unlink if File.exist?(mp4_temp_file.path)
          Rails.logger.info "MP4 temporary file cleaned up successfully"
        rescue => cleanup_error
          Rails.logger.error "Error cleaning up MP4 temp file: #{cleanup_error.message}"
        end
      end
    end
  end
end 