module Ai
  module Openai
    class TtsService
      attr_reader :text

      # Class-level mutex to prevent concurrent TTS requests
      @@tts_mutex = Mutex.new

      def initialize(text:)
        @text = text
      end

      def call
        # Use mutex to ensure only one TTS request at a time
        @@tts_mutex.synchronize do
          Timeout::timeout(30) do
            Rails.logger.info "TTS: Starting request for text length: #{text.length}"
            
            response = openai_client.audio.speech(
              parameters: {
                model: "tts-1",
                input: text,
                voice: "alloy",
                response_format: "mp3"
              }
            )
            
            Rails.logger.info "TTS: Successfully completed request"
            response
          end
        end
      rescue Timeout::Error
        Rails.logger.error "TTS Error: Request timed out after 30 seconds"
        raise StandardError, "TTS request timed out"
      rescue => e
        Rails.logger.error "TTS Error: #{e.class.name} - #{e.message}"
        raise e
      end

      private

      def openai_client
        @openai_client ||= OpenAI::Client.new(
          access_token: ENV["OPENAI_API_KEY"],
          request_timeout: 25,
          read_timeout: 25,
          write_timeout: 5
        )
      end
    end
  end
end 