class App::SynastriesController < App::ApplicationController
  def index
    # Load all birth charts for the dropdowns
    @birth_charts = Current.user.birth_charts.order(:first_name, :last_name)
    
    # Get selected birth charts from parameters
    @birth_chart_1_id = params[:birth_chart_1_id]
    @birth_chart_2_id = params[:birth_chart_2_id]
    
    # Find the selected birth charts
    @birth_chart_1 = if @birth_chart_1_id.present?
                       @birth_charts.find_by(id: @birth_chart_1_id)
                     else
                       @birth_charts.first
                     end
    
    @birth_chart_2 = if @birth_chart_2_id.present?
                       @birth_charts.find_by(id: @birth_chart_2_id)
                     else
                       @birth_charts.second || @birth_charts.first
                     end
    
    # Show message if not enough birth charts
    if @birth_charts.count < 2
      flash.now[:alert] = "You need at least 2 birth charts to create a synastry comparison."
    end
  end
end
