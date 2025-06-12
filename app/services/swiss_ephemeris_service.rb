class SwissEphemerisService
  PLANETS = %w[Sun Moon Mercury Venus Mars Jupiter Saturn Uranus Neptune Pluto].freeze
  KARMIC_POINTS = %w[NorthNode SouthNode Chiron Lilith].freeze
  ASTEROIDS = %w[Ceres Pallas Juno Vesta Astraea].freeze  # Main asteroids we want to support
  AVAILABLE_ASTEROIDS = { 5 => 'Astraea', 433 => 'Eros' }.freeze  # Asteroids we actually have files for
  HOUSES  = (1..12).to_a.freeze

  def initialize(birth_chart)
    @birth_chart = birth_chart
  end

  def call
    birth_datetime = @birth_chart.birth
    lat = @birth_chart.latitude
    lon = @birth_chart.longitude
    timezone_offset = birth_datetime.utc_offset / 3600.0

    ut_time = birth_datetime.utc.strftime("%H:%M")
    date_str = birth_datetime.strftime("%d.%m.%Y")

    house_args = "-house#{lon},#{lat},#{timezone_offset},P"
    
    # Set Swiss Ephemeris data path to vendor/swisseph
    ephe_path = Rails.root.join('vendor', 'swisseph').to_s
    
    # Base command for planets, karmic points, houses, chart points, and main asteroids
    cmd = "SE_EPHE_PATH=#{ephe_path} swetest -b#{date_str} -ut#{ut_time} -p0123456789tADFGHI -fPlZVs -g, #{house_args}"

    output = `#{cmd}`
    raise "Swiss Ephemeris failed: #{output}" unless $?.success?

    # Try to get additional asteroids with separate commands (numbered asteroids 5+)
    asteroids_output = ""
    begin
      # Try available asteroids that we have files for (numbered asteroids)
      AVAILABLE_ASTEROIDS.each do |asteroid_num, asteroid_name|
        asteroid_cmd = "SE_EPHE_PATH=#{ephe_path} swetest -b#{date_str} -ut#{ut_time} -ps -xs#{asteroid_num} -fPlZVs -g,"
        asteroid_result = `#{asteroid_cmd} 2>/dev/null`
        if $?.success? && !asteroid_result.include?("not found") && !asteroid_result.include?("illegal")
          # Only add lines that contain actual asteroid data
          asteroid_result.lines.each do |line|
            # Skip header lines and look for lines with asteroid data  
            if line.include?(',') && !line.include?('date ') && !line.include?('UT:') && !line.include?('Epsilon') && !line.include?('Nutation')
              asteroids_output += "#{asteroid_name},#{line.split(',')[1..-1].join(',')}"
            end
          end
        end
      end
    rescue => e
      Rails.logger.warn "Additional asteroid calculation failed: #{e.message}"
      # Continue without additional asteroids if they fail
    end

    {
      planets: parse_planets(output),
      karmic_points: parse_karmic_points(output),
      asteroids: parse_main_asteroids(output) + parse_asteroids(asteroids_output),
      houses: parse_houses(output),
      chart_points: parse_chart_points(output)
    }
  end

  def parse_planets(output)
    output.lines.map do |line|
      parts = line.strip.split(',')
      planet = parts[0]&.strip
      next unless PLANETS.include?(planet)

      longitude = parts[1].to_f
      zodiac = parts[2].strip
      speed = parts[3].to_f
      longitude_speed = parts[4].to_f

      {
        planet: planet,
        longitude: longitude,
        zodiac: zodiac,
        speed: speed,
        retrograde: longitude_speed < 0
      }
    end.compact
  end

  def parse_asteroids(output)
    asteroids = []
    
    # Swiss Ephemeris asteroid name mappings (what swetest actually outputs)
    asteroid_name_mapping = {
      'Ceres' => 'Ceres',
      'Pallas' => 'Pallas', 
      'Juno' => 'Juno',
      'Vesta' => 'Vesta',
      # Sometimes the ephemeris outputs different names or numbers
      '1' => 'Ceres',
      '2' => 'Pallas',
      '3' => 'Juno', 
      '4' => 'Vesta'
    }

    return asteroids if output.blank?

    output.lines.each_with_index do |line, index|
      next if line.blank?
      
      parts = line.strip.split(',')
      next if parts.length < 4
      
      asteroid_identifier = parts[0]&.strip
      next if asteroid_identifier.blank?
      
      # Check if this matches any known asteroid name or number
      mapped_name = nil
      asteroid_name_mapping.each do |key, value|
        if asteroid_identifier.include?(key) || asteroid_identifier == key
          mapped_name = value
          break
        end
      end
      
      # Skip if we can't map this to a known asteroid
      next unless mapped_name
      
      # Skip if this is an error line
      next if line.include?("not found") || line.include?("error") || line.include?("illegal")

      begin
        longitude = parts[1].to_f
        zodiac = parts[2]&.strip
        speed = parts[3].to_f
        longitude_speed = parts[4]&.to_f || 0.0

        # Determine if retrograde (negative speed)
        retrograde = speed < 0

        asteroids << {
          asteroid: mapped_name,
          longitude: longitude,
          zodiac: zodiac,
          speed: speed.abs,
          retrograde: retrograde
        }
      rescue => e
        Rails.logger.warn "Failed to parse asteroid line: #{line.strip} - #{e.message}"
        next
      end
    end

    asteroids
  end

  def parse_karmic_points(output)
    karmic_points = []
    output.lines.each do |line|
      parts = line.strip.split(',')
      point_name = parts[0]&.strip
      
      case point_name
      when 'true Node'
        # Nœud Nord
        karmic_points << {
          name: 'NorthNode',
          longitude: parts[1].to_f,
          zodiac: parts[2].strip,
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
        # Calculer le Nœud Sud (Nœud Nord + 180°)
        north_longitude = parts[1].to_f
        south_longitude = (north_longitude + 180) % 360
        karmic_points << {
          name: 'SouthNode',
          longitude: south_longitude,
          zodiac: calculate_zodiac_from_longitude(south_longitude),
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
      when 'Chiron'
        karmic_points << {
          name: 'Chiron',
          longitude: parts[1].to_f,
          zodiac: parts[2].strip,
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
      when 'mean Apogee', 'mean apogee'
        karmic_points << {
          name: 'Lilith',
          longitude: parts[1].to_f,
          zodiac: parts[2].strip,
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
      end
    end
    karmic_points
  end

  def parse_houses(output)
    output.lines.map do |line|
      if line.strip =~ /^house\s+(\d+)\s*,\s*([\d.]+)\s*,\s*(.+)$/
        {
          house: Regexp.last_match(1).to_i,
          longitude: Regexp.last_match(2).to_f,
          zodiac: Regexp.last_match(3).strip
        }
      end
    end.compact
  end

  def parse_chart_points(output)
    chart_points = []
    
    # Variables to store positions for Part of Fortune calculation
    ascendant_longitude = nil
    sun_longitude = nil
    moon_longitude = nil
    
    # First, extract planet positions for Part of Fortune calculation
    output.each_line do |line|
      parts = line.strip.split(',')
      case parts[0]&.strip
      when 'Sun'
        sun_longitude = parts[1].to_f
      when 'Moon'
        moon_longitude = parts[1].to_f
      end
    end
    
    output.each_line do |line|
      case line.strip
      when /^Ascendant\s*,\s*([\d.]+),\s*(.+)$/
        ascendant_longitude = $1.to_f
        chart_points << { name: "Ascendant", longitude: ascendant_longitude, zodiac: $2.strip }
      when /^MC\s*,\s*([\d.]+),\s*(.+)$/
        chart_points << { name: "MC", longitude: $1.to_f, zodiac: $2.strip }
      when /^ARMC\s*,\s*([\d.]+),\s*(.+)$/
        chart_points << { name: "ARMC", longitude: $1.to_f, zodiac: $2.strip }
      when /^Vertex\s*,\s*([\d.]+),\s*(.+)$/
        chart_points << { name: "Vertex", longitude: $1.to_f, zodiac: $2.strip }
      when /^equat\. Asc\.\s*,\s*([\d.]+),\s*(.+)$/i
        chart_points << { name: "EquatAsc", longitude: $1.to_f, zodiac: $2.strip }
      when /^co-Asc\. W\.Koch\s*,\s*([\d.]+),\s*(.+)$/i
        chart_points << { name: "CoAscWK", longitude: $1.to_f, zodiac: $2.strip }
      when /^co-Asc Munkasey\s*,\s*([\d.]+),\s*(.+)$/i
        chart_points << { name: "CoAscM", longitude: $1.to_f, zodiac: $2.strip }
      when /^Polar Asc\.\s*,\s*([\d.]+),\s*(.+)$/i
        chart_points << { name: "PolarAsc", longitude: $1.to_f, zodiac: $2.strip }
      end
    end
    
    # Calculate Part of Fortune if we have all required positions
    if ascendant_longitude && sun_longitude && moon_longitude
      # Determine if it's a day or night birth based on Sun's position relative to Ascendant
      # If Sun is above horizon (houses 7-12), it's day; if below (houses 1-6), it's night
      # For simplicity, we'll use the traditional formula: Ascendant + Moon - Sun (day formula)
      # Night formula would be: Ascendant + Sun - Moon
      
      # Use day formula as default (most common in modern astrology)
      part_of_fortune_longitude = (ascendant_longitude + moon_longitude - sun_longitude) % 360
      
      chart_points << { 
        name: "PartOfFortune", 
        longitude: part_of_fortune_longitude, 
        zodiac: calculate_zodiac_from_longitude(part_of_fortune_longitude) 
      }
    end
    
    chart_points
  end

  def parse_main_asteroids(output)
    main_asteroids = []
    
    output.lines.each do |line|
      parts = line.strip.split(',')
      asteroid_name = parts[0]&.strip
      
      case asteroid_name
      when 'Ceres'
        main_asteroids << {
          asteroid: 'Ceres',
          longitude: parts[1].to_f,
          zodiac: parts[2].strip,
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
      when 'Pallas'
        main_asteroids << {
          asteroid: 'Pallas',
          longitude: parts[1].to_f,
          zodiac: parts[2].strip,
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
      when 'Juno'
        main_asteroids << {
          asteroid: 'Juno',
          longitude: parts[1].to_f,
          zodiac: parts[2].strip,
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
      when 'Vesta'
        main_asteroids << {
          asteroid: 'Vesta',
          longitude: parts[1].to_f,
          zodiac: parts[2].strip,
          speed: parts[3].to_f,
          retrograde: parts[4].to_f < 0
        }
      end
    end
    
    main_asteroids
  end

  private

  def calculate_zodiac_from_longitude(longitude)
    signs = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sa', 'Cp', 'Aq', 'Pi']
    sign_index = (longitude / 30).floor
    degree_in_sign = longitude - (sign_index * 30)
    degree = degree_in_sign.floor
    minute = ((degree_in_sign % 1) * 60).floor
    "#{degree} #{signs[sign_index]} #{degree < 10 ? ' ' : ''}#{minute}'"
  end

  def create_asteroid_positions(asteroids_data)
    asteroids_data.each do |asteroid_data|
      @birth_chart.asteroid_positions.create!(
        name: asteroid_data[:asteroid],
        longitude: asteroid_data[:longitude],
        zodiac: asteroid_data[:zodiac],
        speed: asteroid_data[:speed],
        retrograde: asteroid_data[:retrograde]
      )
    end
  end
end
