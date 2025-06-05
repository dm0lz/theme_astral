require "test_helper"

class App::BirthChartsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @birth_chart = birth_charts(:one)
  end

  test "should get index" do
    get app_birth_charts_url
    assert_response :success
  end

  test "should get new" do
    get new_app_birth_chart_url
    assert_response :success
  end

  test "should create birth_chart" do
    assert_difference("BirthChart.count") do
      post app_birth_charts_url, params: { birth_chart: {} }
    end

    assert_redirected_to app_birth_chart_url(BirthChart.last)
  end

  test "should show birth_chart" do
    get app_birth_chart_url(@birth_chart)
    assert_response :success
  end

  test "should get edit" do
    get edit_app_birth_chart_url(@birth_chart)
    assert_response :success
  end

  test "should update birth_chart" do
    patch app_birth_chart_url(@birth_chart), params: { birth_chart: {} }
    assert_redirected_to app_birth_chart_url(@birth_chart)
  end

  test "should destroy birth_chart" do
    assert_difference("BirthChart.count", -1) do
      delete app_birth_chart_url(@birth_chart)
    end

    assert_redirected_to app_birth_charts_url
  end
end
