module Ai
  module Openai
    class TtsService
      attr_reader :text

      def initialize(text:)
        @text = text
      end

      def call
        Timeout::timeout(15) do
          response = openai_client.audio.speech(
            parameters: {
              model: "tts-1",
              input: text,
              voice: "alloy",
              response_format: "mp3"
            }
          )
          response
        end
      rescue Timeout::Error
        Rails.logger.error "TTS Error: Request timed out after 15 seconds"
        raise StandardError, "TTS request timed out"
      rescue => e
        Rails.logger.error "TTS Error: #{e.message}"
        raise e
      end

      private

      def openai_client
        @openai_client ||= OpenAI::Client.new(
          access_token: ENV["OPENAI_API_KEY"],
          request_timeout: 10,
          read_timeout: 10,
          write_timeout: 5
        )
      end
    end
  end
end 