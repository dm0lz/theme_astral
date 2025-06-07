require "test_helper"

class App::SynastriesControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get app_synastries_index_url
    assert_response :success
  end
end
