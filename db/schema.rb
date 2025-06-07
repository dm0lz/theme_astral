# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_06_07_204321) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "action_text_rich_texts", force: :cascade do |t|
    t.string "name", null: false
    t.text "body"
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["record_type", "record_id", "name"], name: "index_action_text_rich_texts_uniqueness", unique: true
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "birth_charts", force: :cascade do |t|
    t.datetime "birth"
    t.float "latitude"
    t.float "longitude"
    t.string "first_name"
    t.string "last_name"
    t.string "city"
    t.string "country"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_birth_charts_on_user_id"
  end

  create_table "chart_points", force: :cascade do |t|
    t.bigint "birth_chart_id", null: false
    t.string "name"
    t.float "longitude"
    t.string "zodiac"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["birth_chart_id"], name: "index_chart_points_on_birth_chart_id"
  end

  create_table "chat_messages", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "author"
    t.text "body"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_chat_messages_on_user_id"
  end

  create_table "contacts", force: :cascade do |t|
    t.string "name"
    t.string "email"
    t.string "consultation_type"
    t.datetime "birth_datetime"
    t.string "birthplace"
    t.datetime "consultation_datetime"
    t.text "message"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "house_positions", force: :cascade do |t|
    t.bigint "birth_chart_id", null: false
    t.integer "house"
    t.float "longitude"
    t.string "zodiac"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["birth_chart_id"], name: "index_house_positions_on_birth_chart_id"
  end

  create_table "karmic_points", force: :cascade do |t|
    t.bigint "birth_chart_id", null: false
    t.string "name", null: false
    t.decimal "longitude", precision: 10, scale: 7, null: false
    t.string "zodiac"
    t.decimal "speed", precision: 10, scale: 7
    t.boolean "retrograde", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["birth_chart_id", "name"], name: "index_karmic_points_on_birth_chart_id_and_name", unique: true
    t.index ["birth_chart_id"], name: "index_karmic_points_on_birth_chart_id"
  end

  create_table "keywords", force: :cascade do |t|
    t.string "name"
    t.boolean "is_long_tail"
    t.string "pillar"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_keywords_on_name", unique: true
    t.index ["pillar"], name: "index_keywords_on_pillar"
  end

  create_table "notebooks", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "title"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_notebooks_on_user_id"
  end

  create_table "notes", force: :cascade do |t|
    t.bigint "notebook_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["notebook_id"], name: "index_notes_on_notebook_id"
    t.index ["user_id"], name: "index_notes_on_user_id"
  end

  create_table "planet_positions", force: :cascade do |t|
    t.bigint "birth_chart_id", null: false
    t.string "planet"
    t.float "longitude"
    t.string "zodiac"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "retrograde"
    t.index ["birth_chart_id"], name: "index_planet_positions_on_birth_chart_id"
  end

  create_table "seo_pages", force: :cascade do |t|
    t.bigint "keyword_id", null: false
    t.string "slug"
    t.string "pillar"
    t.string "meta_title"
    t.string "meta_description"
    t.text "headline"
    t.text "subheading"
    t.text "content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["keyword_id"], name: "index_seo_pages_on_keyword_id"
    t.index ["pillar"], name: "index_seo_pages_on_pillar"
    t.index ["slug"], name: "index_seo_pages_on_slug", unique: true
  end

  create_table "sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "birth_charts", "users"
  add_foreign_key "chart_points", "birth_charts"
  add_foreign_key "chat_messages", "users"
  add_foreign_key "house_positions", "birth_charts"
  add_foreign_key "karmic_points", "birth_charts"
  add_foreign_key "notebooks", "users"
  add_foreign_key "notes", "notebooks"
  add_foreign_key "notes", "users"
  add_foreign_key "planet_positions", "birth_charts"
  add_foreign_key "seo_pages", "keywords"
  add_foreign_key "sessions", "users"
end
