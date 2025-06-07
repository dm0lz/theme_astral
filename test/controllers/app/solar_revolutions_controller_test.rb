require "test_helper"

class App::SolarRevolutionsControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get app_solar_revolutions_index_url
    assert_response :success
  end
end
