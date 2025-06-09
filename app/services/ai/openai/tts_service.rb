module Ai
  module Openai
    class TtsService
      attr_reader :text

      def initialize(text:)
        @text = text
      end

      def call
        response = openai_client.audio.speech(
          parameters: {
            model: "tts-1",
            input: text,
            voice: "alloy",
            response_format: "mp3"
          }
        )
        response
      rescue => e
        Rails.logger.error "TTS Error: #{e.message}"
        raise e
      end

      private

      def openai_client
        @openai_client ||= OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])
      end
    end
  end
end 