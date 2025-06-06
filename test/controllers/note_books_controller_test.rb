require "test_helper"

class NoteBooksControllerTest < ActionDispatch::IntegrationTest
  setup do
    @note_book = note_books(:one)
  end

  test "should get index" do
    get note_books_url
    assert_response :success
  end

  test "should get new" do
    get new_note_book_url
    assert_response :success
  end

  test "should create note_book" do
    assert_difference("NoteBook.count") do
      post note_books_url, params: { note_book: { description: @note_book.description, title: @note_book.title, user_id: @note_book.user_id } }
    end

    assert_redirected_to note_book_url(NoteBook.last)
  end

  test "should show note_book" do
    get note_book_url(@note_book)
    assert_response :success
  end

  test "should get edit" do
    get edit_note_book_url(@note_book)
    assert_response :success
  end

  test "should update note_book" do
    patch note_book_url(@note_book), params: { note_book: { description: @note_book.description, title: @note_book.title, user_id: @note_book.user_id } }
    assert_redirected_to note_book_url(@note_book)
  end

  test "should destroy note_book" do
    assert_difference("NoteBook.count", -1) do
      delete note_book_url(@note_book)
    end

    assert_redirected_to note_books_url
  end
end
