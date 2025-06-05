require "test_helper"

class App::ChatMessagesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @app_chat_message = app_chat_messages(:one)
  end

  test "should get index" do
    get app_chat_messages_url
    assert_response :success
  end

  test "should get new" do
    get new_app_chat_message_url
    assert_response :success
  end

  test "should create app_chat_message" do
    assert_difference("App::ChatMessage.count") do
      post app_chat_messages_url, params: { app_chat_message: {} }
    end

    assert_redirected_to app_chat_message_url(App::ChatMessage.last)
  end

  test "should show app_chat_message" do
    get app_chat_message_url(@app_chat_message)
    assert_response :success
  end

  test "should get edit" do
    get edit_app_chat_message_url(@app_chat_message)
    assert_response :success
  end

  test "should update app_chat_message" do
    patch app_chat_message_url(@app_chat_message), params: { app_chat_message: {} }
    assert_redirected_to app_chat_message_url(@app_chat_message)
  end

  test "should destroy app_chat_message" do
    assert_difference("App::ChatMessage.count", -1) do
      delete app_chat_message_url(@app_chat_message)
    end

    assert_redirected_to app_chat_messages_url
  end
end
