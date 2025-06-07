class App::ChatMessagesController < App::ApplicationController
  before_action :set_chat_message, only: %i[ show edit update destroy ]

  # GET /app/chat_messages or /app/chat_messages.json
  def index
    @chat_messages = Current.user.chat_messages.order(created_at: :desc)
  end

  # GET /app/chat_messages/1 or /app/chat_messages/1.json
  def show
  end

  # GET /app/chat_messages/new
  def new
    @chat_message = Current.user.chat_messages.build
  end

  # GET /app/chat_messages/1/edit
  def edit
  end

  # POST /app/chat_messages or /app/chat_messages.json
  def create
    @chat_message = Current.user.chat_messages.build(app_chat_message_params)
  
    respond_to do |format|
      if @chat_message.save
        CreateChatMessageJob.perform_later(@chat_message)
        format.turbo_stream do
          render turbo_stream: [
            turbo_stream.prepend("chat_messages", partial: "app/chat_messages/chat_message", locals: { chat_message: @chat_message }),
            turbo_stream.replace("chat_form", partial: "app/chat_messages/form", locals: { chat_message: ChatMessage.new }),
            turbo_stream.prepend("chat_messages", partial: "app/chat_messages/temp_message")
          ]
        end
      else
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace("chat_form", partial: "app/chat_messages/form", locals: { chat_message: @chat_message }), status: :unprocessable_entity
        end
        format.html { render :new, status: :unprocessable_entity }
      end
    end
  end
  

  # PATCH/PUT /app/chat_messages/1 or /app/chat_messages/1.json
  def update
    respond_to do |format|
      if @chat_message.update(app_chat_message_params)
        format.html { redirect_to [:app, @chat_message], notice: "Chat message was successfully updated." }
        format.json { render :show, status: :ok, location: @chat_message }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @chat_message.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /app/chat_messages/1 or /app/chat_messages/1.json
  def destroy
    @chat_message.destroy!

    respond_to do |format|
      format.html { redirect_to app_chat_messages_path, status: :see_other, notice: "Chat message was successfully destroyed." }
      format.json { head :no_content }
    end
  end
  
  def clear
    @chat_messages = Current.user.chat_messages.destroy_all
    redirect_to app_chat_messages_path, status: :see_other, notice: "Chat messages were successfully destroyed."
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_chat_message
      @chat_message = Current.user.chat_messages.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def app_chat_message_params
      params.require(:chat_message).permit(:body, :author)
    end
end
