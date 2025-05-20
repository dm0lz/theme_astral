require "test_helper"

class Public::LandingPageControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get public_landing_page_index_url
    assert_response :success
  end
end
