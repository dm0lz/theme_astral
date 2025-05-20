require "test_helper"

class Public::SeoPageControllerTest < ActionDispatch::IntegrationTest
  test "should get show" do
    get public_seo_page_show_url
    assert_response :success
  end
end
