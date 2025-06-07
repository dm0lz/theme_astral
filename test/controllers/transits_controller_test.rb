require "test_helper"

class TransitsControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get transits_index_url
    assert_response :success
  end
end
