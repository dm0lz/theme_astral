require "test_helper"

class Public::ContactsControllerTest < ActionDispatch::IntegrationTest
  test "should get create" do
    get public_contacts_create_url
    assert_response :success
  end
end
