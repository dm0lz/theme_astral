class SwissEphemerisService
  PLANETS = %w[Sun Moon Mercury Venus Mars Jupiter Saturn Uranus Neptune Pluto].freeze
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

    # Use house system 'P' (Placidus)
    house_args = "-house#{lon},#{lat},#{timezone_offset},P"
    cmd = "swetest -b#{date_str} -ut#{ut_time} -p0123456789 -fPlZ -g, #{house_args}"

    output = `#{cmd}`
    raise "Swiss Ephemeris failed: #{output}" unless $?.success?

    {
      planets: parse_planets(output),
      houses: parse_houses(output),
      chart_points: parse_chart_points(output)
    }
  end

  private

  def parse_planets(output)
    output.lines.map do |line|
      planet, longitude, zodiac = line.strip.split(',')
      next unless PLANETS.include?(planet&.strip)

      {
        planet: planet.strip,
        longitude: longitude.to_f,
        zodiac: zodiac.strip
      }
    end.compact
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
end
