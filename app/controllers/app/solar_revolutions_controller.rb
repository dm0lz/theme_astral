require 'ostruct'

class App::SolarRevolutionsController < App::ApplicationController
  def index
    # Load all birth charts for the dropdown
    @birth_charts = Current.user.birth_charts.order(:first_name, :last_name)
    
    # Get selected birth chart from parameters
    @birth_chart_id = params[:birth_chart_id]
    @selected_year = params[:year]&.to_i
    
    # Find the selected birth chart
    @birth_chart = if @birth_chart_id.present?
                     @birth_charts.find_by(id: @birth_chart_id)
                   else
                     @birth_charts.first
                   end
    
    if @birth_chart
      # Calculate available years (birth year to current year + 2)
      birth_year = @birth_chart.birth.year
      current_year = Date.current.year
      @available_years = (birth_year..current_year + 2).to_a.reverse
      
      # Default to current year if not specified
      @selected_year ||= current_year
      
      # Calculate solar revolution date for the selected year
      if @selected_year && @selected_year >= birth_year
        @solar_revolution_date = calculate_solar_revolution_date(@birth_chart, @selected_year)
        
        # Create a temporary birth chart for the solar revolution
        if @solar_revolution_date
          @solar_revolution_chart = create_solar_revolution_chart(@birth_chart, @solar_revolution_date)
        end
      end
    end
    
    # Show message if no birth charts
    if @birth_charts.empty?
      flash.now[:alert] = "You need at least 1 birth chart to create solar revolution analysis."
    end
  end
  
  private
  
  def calculate_solar_revolution_date(birth_chart, year)
    # Get the natal Sun position
    natal_positions = SwissEphemerisService.new(birth_chart).call
    natal_sun = natal_positions[:planets].find { |p| p[:planet] == 'Sun' }
    return nil unless natal_sun
    
    natal_sun_longitude = natal_sun[:longitude]
    
    # Find the approximate date when Sun returns to natal position in the given year
    birth_date = birth_chart.birth
    natal_month = birth_date.month
    natal_day = birth_date.day
    
    # Start with the birthday in the requested year as initial guess
    approximate_date = begin
      DateTime.new(year, natal_month, natal_day, 12, 0, 0)
    rescue ArgumentError
      # Handle leap year issues (Feb 29)
      DateTime.new(year, natal_month, 28, 12, 0, 0)
    end
    
    # Search for the exact moment using binary search approach
    # Solar year is approximately 365.25 days, so Sun moves ~0.986°/day
    search_window = 2 # Search within 2 days of approximate date
    
    best_date = approximate_date
    best_difference = Float::INFINITY
    
    # Check dates within the search window (in 1-hour increments for precision)
    (-search_window * 24..search_window * 24).each do |hour_offset|
      test_date = approximate_date + (hour_offset / 24.0)
      
      # Create temporary chart for this test date
      temp_chart = BirthChart.new(
        birth: test_date,
        latitude: birth_chart.latitude,
        longitude: birth_chart.longitude
      )
      
      begin
        # Get Sun position for this test date
        test_positions = SwissEphemerisService.new(temp_chart).call
        test_sun = test_positions[:planets].find { |p| p[:planet] == 'Sun' }
        next unless test_sun
        
        test_sun_longitude = test_sun[:longitude]
        
        # Calculate the angular difference (accounting for 360° wrap)
        raw_diff = (test_sun_longitude - natal_sun_longitude).abs
        angular_diff = raw_diff > 180 ? 360 - raw_diff : raw_diff
        
        # Update best match if this is closer
        if angular_diff < best_difference
          best_difference = angular_diff
          best_date = test_date
        end
        
        # If we're within 0.01° (about 36 arc seconds), that's precise enough
        break if angular_diff < 0.01
        
      rescue => e
        Rails.logger.warn "Error calculating solar revolution for #{test_date}: #{e.message}"
        next
      end
    end
    
    Rails.logger.info "Solar Revolution #{year}: Best match at #{best_date} with #{best_difference.round(3)}° difference"
    best_date
  end
  
  def create_solar_revolution_chart(birth_chart, solar_revolution_date)
    # Create a temporary birth chart object for the solar revolution
    # This uses the same location as the birth chart but the solar revolution date
    temp_chart = BirthChart.new(
      first_name: "Solar Revolution",
      last_name: @selected_year.to_s,
      birth: solar_revolution_date,
      city: birth_chart.city,
      country: birth_chart.country,
      latitude: birth_chart.latitude,
      longitude: birth_chart.longitude,
      user_id: Current.user.id
    )
    
    # Calculate positions for this temporary chart
    positions_data = SwissEphemerisService.new(temp_chart).call
    
    # Create temporary position objects (not saved to database)
    temp_chart.define_singleton_method(:planet_positions) do
      positions_data[:planets].map do |planet_data|
        OpenStruct.new(
          planet: planet_data[:planet],
          longitude: planet_data[:longitude],
          zodiac: planet_data[:zodiac],
          retrograde: planet_data[:retrograde]
        )
      end
    end
    
    temp_chart.define_singleton_method(:house_positions) do
      positions_data[:houses].map do |house_data|
        OpenStruct.new(
          house: house_data[:house],
          longitude: house_data[:longitude]
        )
      end
    end
    
    temp_chart.define_singleton_method(:chart_points) do
      positions_data[:chart_points].map do |point_data|
        OpenStruct.new(
          name: point_data[:name],
          longitude: point_data[:longitude]
        )
      end
    end
    
    temp_chart
  end
end
