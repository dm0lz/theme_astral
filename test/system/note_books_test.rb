require "application_system_test_case"

class NoteBooksTest < ApplicationSystemTestCase
  setup do
    @note_book = note_books(:one)
  end

  test "visiting the index" do
    visit note_books_url
    assert_selector "h1", text: "Note books"
  end

  test "should create note book" do
    visit note_books_url
    click_on "New note book"

    fill_in "Description", with: @note_book.description
    fill_in "Title", with: @note_book.title
    fill_in "User", with: @note_book.user_id
    click_on "Create Note book"

    assert_text "Note book was successfully created"
    click_on "Back"
  end

  test "should update Note book" do
    visit note_book_url(@note_book)
    click_on "Edit this note book", match: :first

    fill_in "Description", with: @note_book.description
    fill_in "Title", with: @note_book.title
    fill_in "User", with: @note_book.user_id
    click_on "Update Note book"

    assert_text "Note book was successfully updated"
    click_on "Back"
  end

  test "should destroy Note book" do
    visit note_book_url(@note_book)
    click_on "Destroy this note book", match: :first

    assert_text "Note book was successfully destroyed"
  end
end
