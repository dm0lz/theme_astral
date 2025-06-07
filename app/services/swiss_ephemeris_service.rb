class SwissEphemerisService
  PLANETS = %w[Sun Moon Mercury Venus Mars Jupiter Saturn Uranus Neptune Pluto].freeze
  KARMIC_POINTS = %w[NorthNode SouthNode Chiron Lilith].freeze
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
    ENV['SE_EPHE_PATH'] = Rails.root.join('vendor', 'swisseph').to_s
    
    cmd = "swetest -b#{date_str} -ut#{ut_time} -p0123456789tAD -fPlZVs -g, #{house_args}"

    output = `#{cmd}`
    raise "Swiss Ephemeris failed: #{output}" unless $?.success?

    {
      planets: parse_planets(output),
      karmic_points: parse_karmic_points(output),
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
    output.each_line do |line|
      case line.strip
      when /^Ascendant\s*,\s*([\d.]+),\s*(.+)$/
        chart_points << { name: "Ascendant", longitude: $1.to_f, zodiac: $2.strip }
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
    chart_points
  end

  private

  def calculate_zodiac_from_longitude(longitude)
    signs = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sa', 'Cp', 'Aq', 'Pi']
    sign_index = (longitude / 30).floor
    degree_in_sign = longitude - (sign_index * 30)
    degree = degree_in_sign.floor
    minute = ((degree_in_sign % 1) * 60).floor
    "#{degree} #{signs[sign_index]} #{minute}'"
  end
end
