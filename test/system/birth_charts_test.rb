require "application_system_test_case"

class BirthChartsTest < ApplicationSystemTestCase
  setup do
    @birth_chart = birth_charts(:one)
  end

  test "visiting the index" do
    visit birth_charts_url
    assert_selector "h1", text: "Birth charts"
  end

  test "should create birth chart" do
    visit birth_charts_url
    click_on "New birth chart"

    click_on "Create Birth chart"

    assert_text "Birth chart was successfully created"
    click_on "Back"
  end

  test "should update Birth chart" do
    visit birth_chart_url(@birth_chart)
    click_on "Edit this birth chart", match: :first

    click_on "Update Birth chart"

    assert_text "Birth chart was successfully updated"
    click_on "Back"
  end

  test "should destroy Birth chart" do
    visit birth_chart_url(@birth_chart)
    click_on "Destroy this birth chart", match: :first

    assert_text "Birth chart was successfully destroyed"
  end
end
