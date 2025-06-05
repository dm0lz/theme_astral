require "application_system_test_case"

class App::ChatMessagesTest < ApplicationSystemTestCase
  setup do
    @app_chat_message = app_chat_messages(:one)
  end

  test "visiting the index" do
    visit app_chat_messages_url
    assert_selector "h1", text: "Chat messages"
  end

  test "should create chat message" do
    visit app_chat_messages_url
    click_on "New chat message"

    click_on "Create Chat message"

    assert_text "Chat message was successfully created"
    click_on "Back"
  end

  test "should update Chat message" do
    visit app_chat_message_url(@app_chat_message)
    click_on "Edit this chat message", match: :first

    click_on "Update Chat message"

    assert_text "Chat message was successfully updated"
    click_on "Back"
  end

  test "should destroy Chat message" do
    visit app_chat_message_url(@app_chat_message)
    click_on "Destroy this chat message", match: :first

    assert_text "Chat message was successfully destroyed"
  end
end
