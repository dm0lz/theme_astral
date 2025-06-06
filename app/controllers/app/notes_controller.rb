class App::NotesController < App::ApplicationController
  before_action :set_notebook, only: %i[ new create ]
  before_action :set_note, only: %i[ show edit update destroy ]

  # GET /notes or /notes.json
  def index
    @notes = Current.user.notes.includes(:notebook).order(created_at: :desc)
  end

  # GET /notes/1 or /notes/1.json
  def show
  end

  # GET /notes/new
  def new
    if @notebook
      @note = @notebook.notes.build
    else
      # For standalone note creation, we need a notebook
      @note = Note.new
      @note.notebook_id = params[:notebook_id] if params[:notebook_id]
    end
  end

  # GET /notes/1/edit
  def edit
  end

  # POST /notes or /notes.json
  def create
    #binding.pry
    if @notebook
      @note = @notebook.notes.build(note_params)
    else
      # For standalone note creation, find the notebook
      @note = Note.new(note_params)
    end

    respond_to do |format|
      if @note.save
        redirect_path = @notebook ? app_notebook_path(@notebook) : app_note_path(@note)
        format.html { redirect_to redirect_path, notice: "Note was successfully created." }
        format.json { render :show, status: :created, location: @note }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @note.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /notes/1 or /notes/1.json
  def update
    respond_to do |format|
      if @note.update(note_params)
        format.html { redirect_to app_note_path(@note), notice: "Note was successfully updated." }
        format.json { render :show, status: :ok, location: @note }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @note.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /notes/1 or /notes/1.json
  def destroy
    notebook = @note.notebook
    @note.destroy!

    respond_to do |format|
      redirect_path = notebook ? app_notebook_path(notebook) : app_notes_path
      format.html { redirect_to redirect_path, status: :see_other, notice: "Note was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_notebook
      @notebook = Current.user.notebooks.find(params[:notebook_id]) if params[:notebook_id]
    end

    def set_note
      @note = Current.user.notes.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def note_params
      params.expect(note: [ :notebook_id, :body ])
    end
end
