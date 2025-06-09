class TtsController < ApplicationController
  protect_from_forgery with: :null_session

  def speak
    text_param = params[:text].to_s.strip
    return head :bad_request if text_param.blank?

    audio_data = Ai::Openai::TtsService.new(text: text_param).call

    send_data audio_data,
              filename: "speech.mp3",
              type: "audio/mpeg",
              disposition: "inline"
  end
end 