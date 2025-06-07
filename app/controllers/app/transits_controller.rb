class App::TransitsController < App::ApplicationController
  def index
    # Load all birth charts for the dropdown
    @birth_charts = Current.user.birth_charts.order(:first_name, :last_name)
    
    # Select birth chart based on parameter or default to first
    selected_birth_chart_id = params[:birth_chart_id]
    @birth_chart = if selected_birth_chart_id.present?
                     @birth_charts.find_by(id: selected_birth_chart_id)
                   else
                     @birth_charts.first
                   end
    
    # Fallback if no birth chart found
    return redirect_to app_birth_charts_path, alert: "Please create a birth chart first." unless @birth_chart
    
    # Calculate current positions for transits
    birth_chart = Current.user.birth_charts.build(
      birth: DateTime.now,
      first_name: "astro",
      last_name: "astro",
      city: "Paris",
      country: "France"
    )
    birth_chart.valid?
    positions = SwissEphemerisService.new(birth_chart).call
    @current_positions = positions
  end
end
