json.extract! note_book, :id, :user_id, :title, :description, :created_at, :updated_at
json.url note_book_url(note_book, format: :json)
