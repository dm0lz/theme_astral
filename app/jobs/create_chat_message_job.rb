class CreateChatMessageJob < ApplicationJob
  queue_as :default

  def perform(chat_message)
    Ai::Astro::ChatMessagesService.new(chat_message).call
  end
end