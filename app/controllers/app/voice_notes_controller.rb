class App::VoiceNotesController < App::ApplicationController
  def transcribe
    begin
      # Initialize temp file variables for proper cleanup
      temp_file = nil
      mp4_temp_file = nil
      
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
      
      # Log MediaRecorder capabilities and actual recording details
      if params[:supported_formats].present?
        begin
          supported_formats = JSON.parse(params[:supported_formats])
          Rails.logger.info "MediaRecorder supported formats on this device:"
          supported_formats.each do |format, supported|
            Rails.logger.info "  #{format}: #{supported ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}"
          end
        rescue JSON::ParserError => e
          Rails.logger.warn "Could not parse supported_formats: #{e.message}"
        end
      end
      
      Rails.logger.info "Actual MediaRecorder MIME type used: #{params[:actual_recorder_mime]}" if params[:actual_recorder_mime].present?
      
      # Log comprehensive MediaRecorder production details
      if params[:recording_details].present?
        begin
          recording_details = JSON.parse(params[:recording_details])
          
          Rails.logger.info "=== MEDIARECORDER PRODUCTION DETAILS ==="
          
          # Recording timing
          if recording_details['duration']
            Rails.logger.info "  Recording duration: #{recording_details['duration']}ms (#{(recording_details['duration'] / 1000.0).round(1)}s)"
            Rails.logger.info "  Start time: #{Time.at(recording_details['startTime'] / 1000).strftime('%H:%M:%S.%L')}"
            Rails.logger.info "  End time: #{Time.at(recording_details['endTime'] / 1000).strftime('%H:%M:%S.%L')}"
          end
          
          # MediaRecorder configuration
          Rails.logger.info "  MediaRecorder Configuration:"
          Rails.logger.info "    Requested MIME: #{recording_details['requestedMimeType'] || 'none'}"
          Rails.logger.info "    Selected MIME: #{recording_details['selectedMimeType'] || 'unknown'}"
          Rails.logger.info "    Final state: #{recording_details['mediaRecorderState']}"
          Rails.logger.info "    Audio bitrate: #{recording_details['audioBitsPerSecond'] || 'auto'}"
          Rails.logger.info "    Video bitrate: #{recording_details['videoBitsPerSecond'] || 'N/A'}"
          Rails.logger.info "    Timeslice used: #{recording_details['timesliceUsed'] || 'none'}ms"
          Rails.logger.info "    Fallback used: #{recording_details['fallbackUsed'] ? '⚠️ YES' : '✅ NO'}"
          
          # Creation errors
          if recording_details['creationErrors'] && recording_details['creationErrors'].length > 0
            Rails.logger.warn "  MediaRecorder Creation Errors:"
            recording_details['creationErrors'].each { |error| Rails.logger.warn "    - #{error}" }
          end
          
          # Audio chunks analysis
          Rails.logger.info "  Audio Chunks Analysis:"
          Rails.logger.info "    Total chunks: #{recording_details['totalChunks']}"
          Rails.logger.info "    Total chunk size: #{recording_details['totalChunkSize']} bytes"
          Rails.logger.info "    Average chunk size: #{recording_details['averageChunkSize']} bytes"
          Rails.logger.info "    Final blob size: #{recording_details['finalBlobSize']} bytes"
          Rails.logger.info "    Final blob type: #{recording_details['finalBlobType']}"
          Rails.logger.info "    Size consistency: #{recording_details['sizeMismatch'] ? '⚠️ MISMATCH' : '✅ CONSISTENT'}"
          
          # Chunk size distribution
          if recording_details['chunkSizes'] && recording_details['chunkSizes'].length > 0
            chunk_sizes = recording_details['chunkSizes']
            Rails.logger.info "    Chunk sizes: #{chunk_sizes.join(', ')} bytes"
            Rails.logger.info "    Min chunk: #{chunk_sizes.min} bytes"
            Rails.logger.info "    Max chunk: #{chunk_sizes.max} bytes"
            Rails.logger.info "    Size variance: #{chunk_sizes.max - chunk_sizes.min} bytes"
          end
          
          # Audio stream properties
          if recording_details['audioStreamSettings']
            Rails.logger.info "  Audio Stream Settings:"
            settings = recording_details['audioStreamSettings']
            Rails.logger.info "    Sample rate: #{settings['sampleRate']} Hz"
            Rails.logger.info "    Channels: #{settings['channelCount']}"
            Rails.logger.info "    Echo cancellation: #{settings['echoCancellation']}"
            Rails.logger.info "    Noise suppression: #{settings['noiseSuppression']}"
            Rails.logger.info "    Auto gain control: #{settings['autoGainControl']}"
            Rails.logger.info "    Device ID: #{settings['deviceId'] || 'default'}"
            Rails.logger.info "    Latency: #{settings['latency']} seconds" if settings['latency']
            Rails.logger.info "    Volume: #{settings['volume']}" if settings['volume']
          end
          
          # Audio stream capabilities
          if recording_details['audioStreamCapabilities'] && !recording_details['audioStreamCapabilities']['error']
            Rails.logger.info "  Audio Stream Capabilities:"
            caps = recording_details['audioStreamCapabilities']
            Rails.logger.info "    Sample rate range: #{caps['sampleRate']}" if caps['sampleRate']
            Rails.logger.info "    Channel count range: #{caps['channelCount']}" if caps['channelCount']
            Rails.logger.info "    Echo cancellation: #{caps['echoCancellation']}" if caps['echoCancellation']
            Rails.logger.info "    Noise suppression: #{caps['noiseSuppression']}" if caps['noiseSuppression']
            Rails.logger.info "    Auto gain control: #{caps['autoGainControl']}" if caps['autoGainControl']
          end
          
          # Browser/device context
          Rails.logger.info "  Browser/Device Context:"
          Rails.logger.info "    Platform: #{recording_details['platform']}"
          Rails.logger.info "    Max touch points: #{recording_details['maxTouchPoints']}"
          Rails.logger.info "    User agent: #{recording_details['userAgent'][0..80]}..." if recording_details['userAgent']
          
          Rails.logger.info "=== END MEDIARECORDER PRODUCTION DETAILS ==="
        rescue JSON::ParserError => e
          Rails.logger.warn "Could not parse recording_details: #{e.message}"
        end
      end
      
      # Detailed file analysis
      Rails.logger.info "=== AUDIO FILE ANALYSIS ==="
      Rails.logger.info "  Original filename: #{audio_file.original_filename}"
      Rails.logger.info "  Content-Type header: #{audio_file.content_type}"
      Rails.logger.info "  Frontend reported MIME: #{params[:mime_type]}"
      Rails.logger.info "  Frontend reported size: #{params[:file_size]} bytes"
      Rails.logger.info "  Actual server file size: #{audio_file.size} bytes"
      Rails.logger.info "  Size match: #{params[:file_size].to_i == audio_file.size ? '✅ YES' : '❌ NO'}"
      
      # Try to read first few bytes for file signature analysis
      begin
        audio_file.rewind
        first_bytes = audio_file.read(16)
        audio_file.rewind
        
        # Convert to hex for logging
        hex_signature = first_bytes.unpack('H*').first.upcase
        Rails.logger.info "  File signature (hex): #{hex_signature[0..31]}..." # First 16 bytes
        
        # Detect actual file type by signature
        actual_format = case hex_signature
                       when /^52494646.{8}57415645/ # RIFF...WAVE
                         'WAV'
                       when /^000000.{2}667479706D703434/ # ...ftypmp4
                         'MP4'
                       when /^000000.{2}6674797069736F6D/ # ...ftypisom
                         'MP4/ISOM'
                       when /^1A45DFA3/ # EBML (WebM)
                         'WebM'
                       when /^4F676753/ # OggS
                         'OGG'
                       when /^494433/ # ID3
                         'MP3'
                       when /^FFFB/, /^FFF3/, /^FFF2/ # MP3 sync patterns
                         'MP3'
                       else
                         'UNKNOWN'
                       end
        
        Rails.logger.info "  Detected format by signature: #{actual_format}"
        Rails.logger.info "  Format consistency: #{audio_file.content_type.include?(actual_format.downcase) ? '✅ CONSISTENT' : '⚠️ MISMATCH'}"
        
        # Deep content analysis for corruption detection
        Rails.logger.info "=== DEEP AUDIO CONTENT ANALYSIS ==="
        
        # Read entire file for deeper analysis
        audio_file.rewind
        file_content = audio_file.read
        audio_file.rewind
        
        # 1. File size vs. duration estimation
        if actual_format == 'MP4' && file_content.length > 100
          # Rough MP4 duration estimation (very approximate)
          # Look for 'mvhd' atom which contains duration info
          mvhd_match = file_content.match(/mvhd.{4}(.{4})/n)
          if mvhd_match
            timescale_bytes = mvhd_match[1]
            timescale = timescale_bytes.unpack('N')[0] if timescale_bytes.length == 4
            Rails.logger.info "  MP4 timescale found: #{timescale}" if timescale && timescale > 0
          end
        end
        
        # 2. Content entropy analysis (randomness test)
        # Well-formed audio should have moderate entropy, corrupted files often have very low/high entropy
        if file_content.length > 1000
          byte_counts = Array.new(256, 0)
          file_content.bytes.each { |byte| byte_counts[byte] += 1 }
          
          # Calculate Shannon entropy
          total_bytes = file_content.length.to_f
          entropy = byte_counts.map { |count|
            if count > 0
              p = count / total_bytes
              -p * Math.log2(p)
            else
              0
            end
          }.sum
          
          Rails.logger.info "  Content entropy: #{entropy.round(3)} bits (0=uniform, 8=random)"
          
          # Audio files typically have entropy between 4-7
          if entropy < 2.0
            Rails.logger.warn "  ⚠️ Very low entropy - possible empty/silent audio or corruption"
          elsif entropy > 7.5
            Rails.logger.warn "  ⚠️ Very high entropy - possible data corruption or encryption"
          else
            Rails.logger.info "  ✅ Normal entropy for audio content"
          end
          
          # 3. Detect obvious corruption patterns
          # Check for large blocks of repeated bytes (sign of corruption)
          max_repeat = 0
          current_repeat = 1
          prev_byte = file_content.bytes.first
          
          file_content.bytes[1..-1].each do |byte|
            if byte == prev_byte
              current_repeat += 1
            else
              max_repeat = [max_repeat, current_repeat].max
              current_repeat = 1
            end
            prev_byte = byte
          end
          
          repeat_percentage = (max_repeat.to_f / file_content.length) * 100
          Rails.logger.info "  Max repeated byte sequence: #{max_repeat} bytes (#{repeat_percentage.round(1)}%)"
          
          if repeat_percentage > 50
            Rails.logger.error "  🚨 CORRUPTION DETECTED: >50% repeated bytes indicates file corruption"
          elsif repeat_percentage > 20
            Rails.logger.warn "  ⚠️ Suspicious: >20% repeated bytes may indicate poor quality or corruption"
          end
        end
        
        # 4. Format-specific corruption checks
        if actual_format == 'MP4'
          # Check for essential MP4 atoms
          required_atoms = ['ftyp', 'moov', 'mdat']
          missing_atoms = []
          
          required_atoms.each do |atom|
            if file_content.include?(atom)
              Rails.logger.info "  ✅ MP4 atom '#{atom}' found"
            else
              missing_atoms << atom
              Rails.logger.error "  ❌ MP4 atom '#{atom}' MISSING"
            end
          end
          
          if missing_atoms.any?
            Rails.logger.error "  🚨 MP4 CORRUPTION: Missing essential atoms: #{missing_atoms.join(', ')}"
          end
          
          # Check for audio track atoms
          audio_atoms = ['stsd', 'mp4a']
          audio_atoms.each do |atom|
            if file_content.include?(atom)
              Rails.logger.info "  ✅ Audio atom '#{atom}' found"
            else
              Rails.logger.warn "  ⚠️ Audio atom '#{atom}' missing - possible audio track corruption"
            end
          end
          
        elsif actual_format == 'WAV'
          # WAV format validation
          if file_content.length < 44
            Rails.logger.error "  🚨 WAV CORRUPTION: File too small for valid WAV header"
          else
            # Check WAV header structure
            riff_size = file_content[4..7].unpack('V')[0] if file_content.length >= 8
            file_size_from_header = riff_size + 8 if riff_size
            
            if file_size_from_header
              size_match = (file_size_from_header - file_content.length).abs < 10
              Rails.logger.info "  WAV header size: #{file_size_from_header}, actual: #{file_content.length} (match: #{size_match ? '✅' : '❌'})"
              
              unless size_match
                Rails.logger.warn "  ⚠️ WAV size mismatch may indicate corruption"
              end
            end
          end
        end
        
        # 5. Zero-content detection
        zero_bytes = file_content.count("\x00")
        zero_percentage = (zero_bytes.to_f / file_content.length) * 100
        Rails.logger.info "  Zero bytes: #{zero_bytes}/#{file_content.length} (#{zero_percentage.round(1)}%)"
        
        if zero_percentage > 90
          Rails.logger.error "  🚨 CORRUPTION: >90% zero bytes indicates empty/corrupted audio"
        elsif zero_percentage > 50
          Rails.logger.warn "  ⚠️ Suspicious: >50% zero bytes may indicate silent or corrupted audio"
        end
        
        # 6. Pattern analysis for MediaRecorder issues
        # Some corrupted MediaRecorder files have specific patterns
        if file_content.length > 1000
          # Check for suspicious patterns common in corrupted mobile recordings
          chunk_size = [1000, file_content.length / 10].min.to_i
          first_chunk = file_content[0...chunk_size]
          last_chunk = file_content[-chunk_size..-1]
          
          if first_chunk == last_chunk
            Rails.logger.error "  🚨 CORRUPTION: First and last chunks identical - MediaRecorder failure pattern"
          end
          
          # Check for excessive identical chunks throughout file
          chunks = file_content.chars.each_slice(chunk_size).map(&:join)
          unique_chunks = chunks.uniq.length
          chunk_diversity = unique_chunks.to_f / chunks.length
          
          Rails.logger.info "  Chunk diversity: #{(chunk_diversity * 100).round(1)}% (#{unique_chunks}/#{chunks.length} unique)"
          
          if chunk_diversity < 0.3
            Rails.logger.error "  🚨 CORRUPTION: <30% chunk diversity indicates repetitive/corrupted content"
          elsif chunk_diversity < 0.5
            Rails.logger.warn "  ⚠️ Low chunk diversity may indicate quality issues"
          end
        end
        
        Rails.logger.info "=== END DEEP AUDIO CONTENT ANALYSIS ==="
        
      rescue => e
        Rails.logger.warn "  Could not analyze file signature: #{e.message}"
      end
      
      Rails.logger.info "=== END AUDIO FILE ANALYSIS ==="

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
      # If iPad produces WAV directly, use it without conversion
      file_extension = case audio_file.content_type
                      when 'audio/mp4'
                        if is_ipad
                          '.wav'  # Convert iPad MP4 to WAV for better Whisper compatibility
                        else
                          '.mp4'  # Keep non-iPad MP4 as-is
                        end
                      when 'audio/wav'
                        '.wav'  # WAV is ideal - no conversion needed even for iPad
                      when 'audio/m4a'
                        '.m4a'  # Keep iPhone's native M4A format
                      when 'audio/aac'
                        '.aac'  # Keep AAC format
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

      Rails.logger.info "Using file extension: #{file_extension} #{is_ipad && audio_file.content_type == 'audio/mp4' ? '(iPad MP4 -> WAV conversion)' : is_ipad && audio_file.content_type == 'audio/wav' ? '(iPad native WAV - no conversion)' : '(native format)'}"

      temp_file = Tempfile.new(['voice_note', file_extension])
      temp_file.binmode
      
      Rails.logger.info "=== AUDIO PROCESSING DECISION ==="
      Rails.logger.info "  Device: #{is_ipad ? 'iPad' : is_iphone ? 'iPhone' : 'Other'}"
      Rails.logger.info "  Input format: #{audio_file.content_type}"
      Rails.logger.info "  Target extension: #{file_extension}"
      Rails.logger.info "  Processing needed: #{is_ipad && audio_file.content_type == 'audio/mp4' ? 'YES (FFmpeg conversion)' : 'NO (direct copy)'}"
      Rails.logger.info "=== END PROCESSING DECISION ==="
      
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
        # Enhanced processing for iPad's poor MediaRecorder quality
        ffmpeg_command = "ffmpeg -y -i #{mp4_temp_file.path} " \
                        "-ar 16000 -ac 1 -sample_fmt s16 " \
                        "-af 'volume=2.0,highpass=f=200,lowpass=f=3000,dynaudnorm=f=500:g=31' " \
                        "-f wav #{temp_file.path} 2>/dev/null"
        Rails.logger.info "Running enhanced iPad FFmpeg command: #{ffmpeg_command}"
        
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
        
        # Validate converted audio quality for iPad debugging
        if File.size(temp_file.path) < 1000
          Rails.logger.error "iPad: Converted WAV file too small (#{File.size(temp_file.path)} bytes) - audio conversion failed"
          render json: { success: false, error: "Audio conversion produced invalid output. Please speak louder and longer on iPad." }
          return
        end
        
        # Log size ratio for debugging iPad audio issues
        conversion_ratio = File.size(temp_file.path).to_f / audio_file.size.to_f
        Rails.logger.info "iPad conversion ratio: #{conversion_ratio.round(2)} (WAV size / original MP4 size)"
        
        if conversion_ratio < 0.5
          Rails.logger.warn "iPad: Very low conversion ratio - possible audio quality issues"
        end
        
        # FFmpeg probe analysis for detailed audio properties
        Rails.logger.info "=== FFMPEG AUDIO PROPERTIES ANALYSIS ==="
        
        begin
          # Analyze original MP4 file
          original_probe = `ffprobe -v quiet -print_format json -show_format -show_streams "#{mp4_temp_file.path}" 2>/dev/null`
          if $?.success? && !original_probe.empty?
            original_data = JSON.parse(original_probe)
            
            Rails.logger.info "  ORIGINAL iPad MP4 Properties:"
            if original_data['format']
              Rails.logger.info "    Duration: #{original_data['format']['duration']} seconds"
              Rails.logger.info "    Bitrate: #{original_data['format']['bit_rate']} bps"
              Rails.logger.info "    Size: #{original_data['format']['size']} bytes"
            end
            
            if original_data['streams'] && original_data['streams'][0]
              stream = original_data['streams'][0]
              Rails.logger.info "    Codec: #{stream['codec_name']}"
              Rails.logger.info "    Sample rate: #{stream['sample_rate']} Hz"
              Rails.logger.info "    Channels: #{stream['channels']}"
              Rails.logger.info "    Channel layout: #{stream['channel_layout']}"
              Rails.logger.info "    Sample format: #{stream['sample_fmt']}" if stream['sample_fmt']
              
              # Corruption indicators
              if stream['sample_rate'].to_i < 8000
                Rails.logger.error "    🚨 CORRUPTION: Sample rate too low (#{stream['sample_rate']} Hz)"
              elsif stream['sample_rate'].to_i > 48000
                Rails.logger.warn "    ⚠️ Unusual: Very high sample rate (#{stream['sample_rate']} Hz)"
              end
              
              if stream['channels'].to_i == 0
                Rails.logger.error "    🚨 CORRUPTION: No audio channels detected"
              elsif stream['channels'].to_i > 2
                Rails.logger.warn "    ⚠️ Unusual: Multi-channel audio (#{stream['channels']} channels)"
              end
            end
          end
          
          # Analyze converted WAV file
          converted_probe = `ffprobe -v quiet -print_format json -show_format -show_streams "#{temp_file.path}" 2>/dev/null`
          if $?.success? && !converted_probe.empty?
            converted_data = JSON.parse(converted_probe)
            
            Rails.logger.info "  CONVERTED WAV Properties:"
            if converted_data['format']
              Rails.logger.info "    Duration: #{converted_data['format']['duration']} seconds"
              Rails.logger.info "    Bitrate: #{converted_data['format']['bit_rate']} bps"
              Rails.logger.info "    Size: #{converted_data['format']['size']} bytes"
            end
            
            if converted_data['streams'] && converted_data['streams'][0]
              stream = converted_data['streams'][0]
              Rails.logger.info "    Codec: #{stream['codec_name']}"
              Rails.logger.info "    Sample rate: #{stream['sample_rate']} Hz"
              Rails.logger.info "    Channels: #{stream['channels']}"
              Rails.logger.info "    Sample format: #{stream['sample_fmt']}" if stream['sample_fmt']
            end
            
            # Compare durations for conversion validation
            if original_data['format'] && converted_data['format']
              orig_duration = original_data['format']['duration'].to_f
              conv_duration = converted_data['format']['duration'].to_f
              duration_diff = (orig_duration - conv_duration).abs
              
              Rails.logger.info "    Duration match: #{duration_diff < 0.1 ? '✅' : '❌'} (diff: #{duration_diff.round(2)}s)"
              
              if duration_diff > 1.0
                Rails.logger.error "    🚨 CONVERSION ISSUE: Duration mismatch >1s indicates conversion problems"
              end
            end
          end
          
        rescue JSON::ParserError => e
          Rails.logger.warn "  Could not parse FFmpeg probe output: #{e.message}"
        rescue => e
          Rails.logger.warn "  FFmpeg probe analysis failed: #{e.message}"
        end
        
        Rails.logger.info "=== END FFMPEG AUDIO PROPERTIES ANALYSIS ==="
        
        # Audio content silence detection for iPad debugging
        Rails.logger.info "=== AUDIO CONTENT SILENCE ANALYSIS ==="
        
        begin
          # Use FFmpeg to analyze audio levels in the converted WAV file
          audio_stats = `ffprobe -f wav -show_entries frame=pkt_pts_time:frame_tags=lavfi.astats.Overall.RMS_level,lavfi.astats.Overall.Peak_level -of csv=p=0 -f lavfi "amovie=#{temp_file.path},astats" 2>/dev/null | head -10`
          
          if $?.success? && !audio_stats.empty?
            Rails.logger.info "  Audio level analysis (first 10 frames):"
            Rails.logger.info "#{audio_stats}"
          else
            # Simpler approach - check for audio content using volume detection
            volume_detect = `ffmpeg -i "#{temp_file.path}" -af "volumedetect" -f null /dev/null 2>&1 | grep -E "(mean_volume|max_volume)"`
            
            if !volume_detect.empty?
              Rails.logger.info "  Audio volume analysis:"
              volume_lines = volume_detect.split("\n")
              volume_lines.each do |line|
                if line.include?("mean_volume")
                  mean_vol = line.match(/-?\d+\.?\d*/)&.to_s&.to_f
                  if mean_vol && mean_vol < -50
                    Rails.logger.error "    🚨 AUDIO TOO QUIET: Mean volume #{mean_vol} dB (< -50 dB indicates very quiet/silent audio)"
                  elsif mean_vol && mean_vol < -30
                    Rails.logger.warn "    ⚠️ Low audio: Mean volume #{mean_vol} dB (may be too quiet for transcription)"
                  else
                    Rails.logger.info "    ✅ Audio level: Mean volume #{mean_vol} dB (sufficient for transcription)"
                  end
                elsif line.include?("max_volume")
                  max_vol = line.match(/-?\d+\.?\d*/)&.to_s&.to_f
                  Rails.logger.info "    Max volume: #{max_vol} dB"
                end
              end
            end
          end
          
          # Check for audio silence using ffmpeg silence detection
          silence_detect = `ffmpeg -i "#{temp_file.path}" -af silencedetect=noise=-30dB:duration=0.5 -f null /dev/null 2>&1 | grep -c "silence_"`
          
          if $?.success?
            silence_count = silence_detect.strip.to_i
            Rails.logger.info "  Silence segments detected: #{silence_count}"
            
            if silence_count > 10
              Rails.logger.error "    🚨 MOSTLY SILENT: #{silence_count} silence segments detected - audio likely unusable"
            elsif silence_count > 5
              Rails.logger.warn "    ⚠️ High silence: #{silence_count} segments - audio may be poor quality"
            else
              Rails.logger.info "    ✅ Low silence: Audio appears to contain speech content"
            end
          end
          
        rescue => e
          Rails.logger.warn "  Audio content analysis failed: #{e.message}"
        end
        
        Rails.logger.info "=== END AUDIO CONTENT SILENCE ANALYSIS ==="
      else
        # For all other formats, write directly
        temp_file.write(audio_file.read)
        
        # FFmpeg probe analysis for non-iPad files (for comparison)
        if system('which ffprobe > /dev/null 2>&1')
          Rails.logger.info "=== NON-IPAD AUDIO PROPERTIES ANALYSIS ==="
          
          begin
            device_name = is_iphone ? 'iPhone' : 'Other Device'
            probe_output = `ffprobe -v quiet -print_format json -show_format -show_streams "#{temp_file.path}" 2>/dev/null`
            
            if $?.success? && !probe_output.empty?
              data = JSON.parse(probe_output)
              
              Rails.logger.info "  #{device_name} Audio Properties:"
              if data['format']
                Rails.logger.info "    Duration: #{data['format']['duration']} seconds"
                Rails.logger.info "    Bitrate: #{data['format']['bit_rate']} bps"
                Rails.logger.info "    Size: #{data['format']['size']} bytes"
                Rails.logger.info "    Format: #{data['format']['format_name']}"
              end
              
              if data['streams'] && data['streams'][0]
                stream = data['streams'][0]
                Rails.logger.info "    Codec: #{stream['codec_name']}"
                Rails.logger.info "    Sample rate: #{stream['sample_rate']} Hz"
                Rails.logger.info "    Channels: #{stream['channels']}"
                Rails.logger.info "    Channel layout: #{stream['channel_layout']}" if stream['channel_layout']
                Rails.logger.info "    Sample format: #{stream['sample_fmt']}" if stream['sample_fmt']
                Rails.logger.info "    Bit depth: #{stream['bits_per_sample']} bits" if stream['bits_per_sample']
                
                # Quality analysis for comparison with iPad
                sample_rate = stream['sample_rate'].to_i
                channels = stream['channels'].to_i
                
                Rails.logger.info "  #{device_name} Quality Assessment:"
                
                if sample_rate >= 44100
                  Rails.logger.info "    ✅ Excellent sample rate (#{sample_rate} Hz)"
                elsif sample_rate >= 22050
                  Rails.logger.info "    ✅ Good sample rate (#{sample_rate} Hz)"
                elsif sample_rate >= 16000
                  Rails.logger.info "    ⚠️ Acceptable sample rate (#{sample_rate} Hz)"
                else
                  Rails.logger.warn "    ❌ Poor sample rate (#{sample_rate} Hz)"
                end
                
                if channels == 1
                  Rails.logger.info "    ✅ Optimal mono audio for speech"
                elsif channels == 2
                  Rails.logger.info "    ✅ Stereo audio (will work fine)"
                else
                  Rails.logger.warn "    ⚠️ Unusual channel count: #{channels}"
                end
                
                # Compare with typical iPad issues
                if data['format'] && data['format']['duration']
                  duration = data['format']['duration'].to_f
                  file_size = data['format']['size'].to_i
                  bitrate = data['format']['bit_rate'].to_i
                  
                  # Calculate quality metrics
                  bytes_per_second = file_size / duration if duration > 0
                  
                  Rails.logger.info "    File efficiency: #{bytes_per_second.round(0)} bytes/sec"
                  Rails.logger.info "    Effective bitrate: #{bitrate} bps"
                  
                  # Flag potential issues that we see on iPad
                  if bitrate < 32000
                    Rails.logger.warn "    ⚠️ Low bitrate - may affect transcription quality"
                  elsif bitrate > 256000
                    Rails.logger.info "    ✅ High quality audio (good for transcription)"
                  else
                    Rails.logger.info "    ✅ Standard quality audio"
                  end
                end
              end
            else
              Rails.logger.warn "  #{device_name}: FFmpeg probe failed or returned empty result"
            end
            
          rescue JSON::ParserError => e
            Rails.logger.warn "  Could not parse #{device_name} FFmpeg probe output: #{e.message}"
          rescue => e
            Rails.logger.warn "  #{device_name} FFmpeg probe analysis failed: #{e.message}"
          end
          
          Rails.logger.info "=== END NON-IPAD AUDIO PROPERTIES ANALYSIS ==="
        end
      end
      
      temp_file.rewind

      Rails.logger.info "Created temporary file: #{temp_file.path} (#{File.size(temp_file.path)} bytes)"

      # iPad-specific validation and logging
      if is_ipad
        Rails.logger.info "iPad SPECIFIC PROCESSING:"
        Rails.logger.info "  - Original MIME type: #{audio_file.content_type}"
        Rails.logger.info "  - File size: #{audio_file.size} bytes"
        Rails.logger.info "  - File extension: #{file_extension}"
        
        if audio_file.content_type == 'audio/wav'
          Rails.logger.info "  - SUCCESS: iPad recorded native WAV (no conversion needed)"
        elsif audio_file.content_type == 'audio/mp4'
          Rails.logger.warn "  - iPad fell back to problematic MP4 format (will convert to WAV)"
        else
          Rails.logger.info "  - iPad using format: #{audio_file.content_type}"
        end
        
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
      
      # Log pre-transcription file details
      Rails.logger.info "=== WHISPER API CALL ==="
      Rails.logger.info "  Final file path: #{temp_file.path}"
      Rails.logger.info "  Final file size: #{File.size(temp_file.path)} bytes"
      Rails.logger.info "  Final file extension: #{file_extension}"
      
      # Try to get more file info
      begin
        file_stat = File.stat(temp_file.path)
        Rails.logger.info "  File created: #{file_stat.ctime}"
        Rails.logger.info "  File modified: #{file_stat.mtime}"
        Rails.logger.info "  File permissions: #{file_stat.mode.to_s(8)}"
      rescue => e
        Rails.logger.warn "  Could not get file stats: #{e.message}"
      end
      
      # Build Whisper API parameters with device-optimized parameters
      whisper_params = {
        model: "whisper-1",  # Only valid model for OpenAI Whisper API
        file: File.open(temp_file.path, 'rb')
      }
      
      # Add general quality improvements for iPad without forcing language
      if is_ipad
        # iPad tends to have audio quality issues, use lower temperature for more consistent results
        whisper_params[:temperature] = 0.0  # Absolutely lowest for maximum consistency on iPad
        # More specific prompt to avoid generic responses like "Thank you for watching"
        whisper_params[:prompt] = "This is a voice note recording in French or English. Common French words: bleu, vert, rouge, jaune, orange, violet, bonjour, merci. Please transcribe exactly what is spoken, not generic phrases."
        Rails.logger.info "Using zero temperature (0.0) and specific speech transcription prompt for iPad audio quality issues"
      elsif is_ios
        # Other iOS devices get moderate temperature adjustment
        whisper_params[:temperature] = 0.2  # Lower temperature for more consistent results
        Rails.logger.info "Using lower temperature (0.2) for iOS device"
      end
      
      Rails.logger.info "  Whisper parameters: #{whisper_params.except(:file).inspect}"
      Rails.logger.info "=== END WHISPER API CALL SETUP ==="
      
      # Make the API call
      start_time = Time.current
      response = client.audio.transcribe(parameters: whisper_params)
      end_time = Time.current
      
      Rails.logger.info "=== WHISPER API RESPONSE ==="
      Rails.logger.info "  API call duration: #{((end_time - start_time) * 1000).round(2)}ms"
      Rails.logger.info "  Response class: #{response.class}"
      Rails.logger.info "  Response keys: #{response.keys.inspect if response.respond_to?(:keys)}"

      transcription = response.dig("text")
      
      if transcription.present?
        Rails.logger.info "  Transcription length: #{transcription.length} characters"
        Rails.logger.info "  Transcription preview: #{transcription[0..100]}#{transcription.length > 100 ? '...' : ''}"
        Rails.logger.info "  Word count: #{transcription.split.length} words"
        Rails.logger.info "  Contains non-ASCII: #{transcription.ascii_only? ? 'NO' : 'YES'}"
        Rails.logger.info "  Language hints detected: #{transcription.match?(/bleu|vert|rouge|jaune|bonjour/i) ? 'French' : 'Other/English'}"
        Rails.logger.info "  Quality indicators:"
        Rails.logger.info "    - Contains generic phrases: #{transcription.match?(/thank you for watching|thanks for watching/i) ? '⚠️ YES' : '✅ NO'}"
        Rails.logger.info "    - Repetitive content: #{transcription.split.uniq.length < transcription.split.length * 0.7 ? '⚠️ YES' : '✅ NO'}"
        Rails.logger.info "    - Reasonable length: #{transcription.length > 5 && transcription.length < 1000 ? '✅ YES' : '⚠️ NO'}"
        
        # Critical check: Whisper returning our prompt indicates silent/unusable audio
        prompt_returned = transcription.downcase.include?("transcribe exactly what is spoken")
        Rails.logger.info "    - Returns our prompt: #{prompt_returned ? '🚨 YES - SILENT AUDIO DETECTED' : '✅ NO'}"
        
        if prompt_returned
          Rails.logger.error "🚨 CRITICAL: Whisper returned our prompt text instead of transcribing audio!"
          Rails.logger.error "This indicates the audio file contains silence or is unusable for transcription."
          Rails.logger.error "iPad MediaRecorder likely produced silent/very quiet audio despite valid file structure."
        end
        
        Rails.logger.info "=== END WHISPER API RESPONSE ==="
        
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