class CreateChatMessageJob < ApplicationJob
  queue_as :default

  def perform(chat_message)
    response = Ai::Astro::ChatMessagesService.new(chat_message).call
    user = chat_message.user
    chat_message = user.chat_messages.create(author: "assistant", body: response)
    Turbo::StreamsChannel.broadcast_append_to(
      "streaming_channel_#{user.id}",
      target: "chat_messages",
      partial: "app/chat_messages/chat_message",
      locals: { chat_message: chat_message }
    )
  end
end