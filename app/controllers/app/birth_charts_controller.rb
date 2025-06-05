module App
  class BirthChartsController < App::ApplicationController
    before_action :set_birth_chart, only: %i[ show edit update destroy ]

    # GET /app/birth_charts or /app/birth_charts.json
    def index
      @birth_charts = BirthChart.all
    end

    # GET /app/birth_charts/1 or /app/birth_charts/1.json
    def show
    end

    # GET /app/birth_charts/new
    def new
      @birth_chart = BirthChart.new
    end

    # GET /app/birth_charts/1/edit
    def edit
    end

    # POST /app/birth_charts or /app/birth_charts.json
    def create
      @birth_chart = BirthChart.new(birth_chart_params)

      respond_to do |format|
        if @birth_chart.save
          format.html { redirect_to [:app, @birth_chart], notice: "Birth chart was successfully created." }
          format.json { render :show, status: :created, location: @birth_chart }
        else
          format.html { render :new, status: :unprocessable_entity }
          format.json { render json: @birth_chart.errors, status: :unprocessable_entity }
        end
      end
    end

    # PATCH/PUT /app/birth_charts/1 or /app/birth_charts/1.json
    def update
      respond_to do |format|
        if @birth_chart.update(birth_chart_params)
          format.html { redirect_to [:app, @birth_chart], notice: "Birth chart was successfully updated." }
          format.json { render :show, status: :ok, location: @birth_chart }
        else
          format.html { render :edit, status: :unprocessable_entity }
          format.json { render json: @birth_chart.errors, status: :unprocessable_entity }
        end
      end
    end

    # DELETE /app/birth_charts/1 or /app/birth_charts/1.json
    def destroy
      @birth_chart.destroy!

      respond_to do |format|
        format.html { redirect_to app_birth_charts_path, status: :see_other, notice: "Birth chart was successfully destroyed." }
        format.json { head :no_content }
      end
    end

    private
    # Use callbacks to share common setup or constraints between actions.
    def set_birth_chart
      @birth_chart = BirthChart.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def birth_chart_params
      params.require(:birth_chart).permit(:first_name, :last_name, :birth, :city, :country)
    end
  end
end
