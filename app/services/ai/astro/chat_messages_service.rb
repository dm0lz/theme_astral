class Ai::Astro::ChatMessagesService
  def initialize(chat_message)
    @chat_message = chat_message
  end

  def call
    client = OpenAI::Client.new(access_token: Rails.application.credentials.deep_seek_api_key, uri_base: "https://api.deepseek.com")
    response = ""
    buffer = ""
    tool_calls_buffer = {}
    
    begin
      # Use streaming with tools - much cleaner approach
      initial_messages = [ { role: "system", content: system_prompt } ] + prompt_messages
      
      client.chat(
        parameters: {
          model: "deepseek-chat",
          temperature: 1.1,
          messages: initial_messages,
          tools: function_tools,
          tool_choice: "auto",
          stream: proc do |chunk, _bytesize|
            # Handle tool calls in streaming
            tool_calls = chunk.dig("choices", 0, "delta", "tool_calls")
            if tool_calls&.any?
              tool_calls.each do |tool_call|
                if tool_call["index"] && tool_call["function"]
                  index = tool_call["index"]
                  
                  # Initialize buffer for this tool call if not exists
                  tool_calls_buffer[index] ||= {
                    id: nil,
                    name: nil,
                    arguments: ""
                  }
                  
                  # Accumulate the function call data
                  if tool_call["id"]
                    tool_calls_buffer[index][:id] = tool_call["id"]
                  end
                  
                  if tool_call["function"]["name"]
                    tool_calls_buffer[index][:name] = tool_call["function"]["name"]
                  end
                  
                  if tool_call["function"]["arguments"]
                    tool_calls_buffer[index][:arguments] += tool_call["function"]["arguments"]
                  end
                end
              end
            end

            # Handle regular content streaming
            delta = chunk.dig("choices", 0, "delta", "content")
            next unless delta
            
            response += delta
            buffer += delta
            
            # Stream content as before
            if buffer.match(/[.!?]\s*$/) || buffer.match(/,\s*$/)
              buffer = buffer.gsub(/[\u{1F600}-\u{1F64F}\u{2728}\u{1F319}\u{1F52E}]/, '')
              buffer = buffer.gsub(/[*#]/, '')
              Turbo::StreamsChannel.broadcast_append_to(
                "streaming_channel_#{@chat_message.user_id}",
                target: "sentence_chunks_container",
                partial: "app/chat_messages/sentence_chunk",
                locals: { sentence: buffer }
              )
              buffer = ""
            end
            
            Turbo::StreamsChannel.broadcast_update_to(
              "streaming_channel_#{@chat_message.user_id}",
              target: "chunks_container",
              partial: "app/chat_messages/chunks_container",
              locals: { response: response }
            )
            sleep 0.12
          end
        }
      )

      # If we only had tool calls and no regular streaming content, show some activity
      if response.blank? && tool_calls_buffer.any?
        # Show a brief "processing" message while tool calls are being handled
        temp_message = "Processing your request ⏳"
        Turbo::StreamsChannel.broadcast_update_to(
          "streaming_channel_#{@chat_message.user_id}",
          target: "chunks_container",
          partial: "app/chat_messages/chunks_container",
          locals: { response: temp_message }
        )
        sleep 0.5
      end

      # Process any accumulated tool calls after streaming completes
      if tool_calls_buffer.any?
        # Build conversation with tool results
        messages_with_tools = initial_messages.dup
        
        # Add the assistant's response with tool calls
        assistant_message = {
          role: "assistant",
          content: response.present? ? response : nil
        }
        
        # Add tool calls to assistant message
        tool_calls_array = []
        tool_calls_buffer.each do |index, call_data|
          if call_data[:name] && call_data[:arguments].present?
            tool_calls_array << {
              id: call_data[:id] || "call_#{index}",
              type: "function",
              function: {
                name: call_data[:name],
                arguments: call_data[:arguments]
              }
            }
          end
        end
        assistant_message[:tool_calls] = tool_calls_array if tool_calls_array.any?
        messages_with_tools << assistant_message
        
        # Execute tool calls and add results to conversation
        tool_calls_buffer.each do |index, call_data|
          if call_data[:name] && call_data[:arguments].present?
            function_result = execute_function_call(call_data)
            
            messages_with_tools << {
              role: "tool",
              tool_call_id: call_data[:id] || "call_#{index}",
              content: function_result
            }
          end
        end
        
        # Show brief processing message with icon
        temp_message = "Analyzing birth chart data 🔍"
        Turbo::StreamsChannel.broadcast_update_to(
          "streaming_channel_#{@chat_message.user_id}",
          target: "chunks_container",
          partial: "app/chat_messages/chunks_container",
          locals: { response: temp_message }
        )
        sleep 0.5
        
        # Reset response and buffer for final streaming
        response = ""
        buffer = ""
        
        # Make final streaming call with tool results
        client.chat(
          parameters: {
            model: "deepseek-chat",
            temperature: 1.1,
            messages: messages_with_tools,
            stream: proc do |chunk, _bytesize|
              delta = chunk.dig("choices", 0, "delta", "content")
              next unless delta
              
              response += delta
              buffer += delta
              
              # Stream the final response
              if buffer.match(/[.!?]\s*$/) || buffer.match(/,\s*$/)
                buffer = buffer.gsub(/[\u{1F600}-\u{1F64F}\u{2728}\u{1F319}\u{1F52E}]/, '')
                buffer = buffer.gsub(/[*#]/, '')
                Turbo::StreamsChannel.broadcast_append_to(
                  "streaming_channel_#{@chat_message.user_id}",
                  target: "sentence_chunks_container",
                  partial: "app/chat_messages/sentence_chunk",
                  locals: { sentence: buffer }
                )
                buffer = ""
              end
              
              Turbo::StreamsChannel.broadcast_update_to(
                "streaming_channel_#{@chat_message.user_id}",
                target: "chunks_container",
                partial: "app/chat_messages/chunks_container",
                locals: { response: response }
              )
              sleep 0.12
            end
          }
        )
      end

    rescue => e
      Rails.logger.error "DeepSeek API error: #{e.message}"
      response = "I apologize, but I'm having trouble connecting to my astrological knowledge base right now. Please try again in a moment."
    end

    # Create and broadcast the final message
    chat_message = ChatMessage.create!(user_id: @chat_message.user_id, body: response, author: "assistant")
    Turbo::StreamsChannel.broadcast_replace_to(
      "streaming_channel_#{@chat_message.user_id}",
      target: "temp_message",
      partial: "app/chat_messages/chat_message",
      locals: { chat_message: chat_message }
    )
    Turbo::StreamsChannel.broadcast_update_to(
      "streaming_channel_#{@chat_message.user_id}",
      target: "chat_form",
      partial: "app/chat_messages/form",
      locals: { chat_message: ChatMessage.new, disabled_send_button: false }
    )
  end

  private

  def prompt_messages
    birth_charts + current_positions + chat_history + [ { role: "user", content: user_prompt } ]
  end

  def user_prompt
    <<~PROMPT.strip
      
      The user sent the following message:
      "#{@chat_message.body}"

      Write a thoughtful, astrology-informed reply to this message.
    PROMPT
  end

  def system_prompt
    <<~PROMPT.strip
      You are a professional astrologer with deep knowledge of natal charts, planetary transits, zodiac signs, asteroids, karmic astrology, houses, and astrological compatibility.

      Your goal is to gather information from the user (first name, last name, birth date, birth time, birth city, birth country) and create a birth chart using function create_birth_chart that will return a birth chart object with all the astrological data including planets, houses, chart points, karmic points, and asteroids positions.
      Then, provide engaging, accurate, and easy-to-understand replies to user messages regarding astrology based on the birth chart object only.
      Do not use any other information than the birth chart object to answer the user's message.
      Tailor each response to sound warm, intuitive, and insightful—like a caring human astrologer, not a robot.

      Keep your reply relevant to the user's message. Be concise, but add meaningful insight. Avoid generic or vague responses.
      
      Your responses must be in the same language that the user's message is in.

      IMPORTANT CAPABILITY: You can create birth charts for users when they provide complete birth information.
      
      BIRTH TIME IS COMPULSORY: You can only create a birth chart when the user provides ALL required information:
      - Full name (first and last name)
      - Exact birth date 
      - Exact birth time (hour and minute in 24-hour format, e.g., "03:15" for 3:15 AM, "15:30" for 3:30 PM)
      - Birth city and country
      
      IMPORTANT: When extracting birth time, always convert to 24-hour format:
      - "3h15 du matin" = "03:15"
      - "3:15 AM" = "03:15" 
      - "3:30 PM" = "15:30"
      - "8:45 AM" = "08:45"
      
      If a user wants a birth chart but doesn't provide the birth time, politely ask them for it, explaining that the exact birth time is essential for accurate astrological calculations (house positions, ascendant, midheaven, etc.).

      Examples of complete birth information:
      - "I was born on March 15, 1990 at 3:30 PM in New York, USA. My name is Sarah Johnson."
      - "Can you create a birth chart for John Smith? He was born December 3, 1985 at 8:45 AM in London, England."
      - "I need my natal chart. Born April 22, 1988, 10:15 AM, Los Angeles, California. I'm Maria Garcia."

      Examples of incomplete information (do NOT create chart):
      - "I was born March 15, 1990 in New York" (missing time)
      - "Born at 3 PM in London" (missing date)
      - "March 15, 1990 at 3 PM" (missing location)

      After creating a birth chart, provide astrological insights based on the calculated planetary positions.
    PROMPT
  end

  # def response_schema
  #   {
  #     strict: true,
  #     name: "chat_message_response",
  #     description: "Generate a concise and insightful astrology-related chat message response.",
  #     schema: {
  #       type: "object",
  #       properties: {
  #         chat_message: {
  #           type: "string",
  #           description: "The generated response to the user's astrology-related message"
  #         }
  #       },
  #       additionalProperties: false,
  #       required: ["chat_message"]
  #     }
  #   }
  # end

  def birth_charts
    @chat_message.user.birth_charts.map do |birth_chart|
      {
        role: "user",
        content: <<~BIRTH_CHART.strip
          Here is the birthchart for #{birth_chart.first_name} #{birth_chart.last_name}:
          Date of birth: #{birth_chart.birth}
          Place of birth: #{birth_chart.location}
          Latitude: #{birth_chart.latitude}
          Longitude: #{birth_chart.longitude}
          City: #{birth_chart.city}
          Country: #{birth_chart.country}
          Planet positions: #{planet_positions(birth_chart.planet_positions)}
          House positions: #{house_positions(birth_chart.house_positions)}
          Chart points: #{chart_points(birth_chart.chart_points)}
          Karmic points: #{karmic_points(birth_chart.karmic_points)}
          Asteroid positions: #{asteroid_positions(birth_chart.asteroid_positions)}
        BIRTH_CHART
      }
    end
  end

  def planet_positions(positions)
    positions.map do |position|
      <<~PLANET_POSITION.strip
        Planet: #{position.planet}
        Longitude: #{position.longitude}
        Zodiac: #{position.zodiac}
        Retrograde: #{position.retrograde}
      PLANET_POSITION
    end.join("\n")
  end

  def house_positions(positions)
    positions.map do |position|
      <<~HOUSE_POSITION.strip
        House: #{position.house}
        Longitude: #{position.longitude}
        Zodiac: #{position.zodiac}
      HOUSE_POSITION
    end.join("\n")
  end

  def chart_points(positions)
    positions.map do |position|
      <<~CHART_POINT.strip
        Chart point: #{position.name}
        Longitude: #{position.longitude}
        Zodiac: #{position.zodiac}
      CHART_POINT
    end.join("\n")
  end

  def karmic_points(positions)
    positions.map do |position|
      <<~KARMIC_POINT.strip
        Karmic point: #{position.name}
        Longitude: #{position.longitude}
        Zodiac: #{position.zodiac}
        Retrograde: #{position.retrograde}
      KARMIC_POINT
    end.join("\n")
  end

  def asteroid_positions(positions)
    positions.map do |position|
      <<~ASTEROID_POSITION.strip
        Asteroid: #{position.name}
        Longitude: #{position.longitude}
        Zodiac: #{position.zodiac}
        Retrograde: #{position.retrograde}
      ASTEROID_POSITION
    end.join("\n")
  end

  def chat_history
    ChatMessage.where(user_id: @chat_message.user_id).order(created_at: :asc).map do |msg|
      {
        role: msg.author,
        content: msg.body
      }
    end
  end

  def current_positions
    birth_chart = @chat_message.user.birth_charts.build(
      birth: DateTime.now,
      first_name: "astro",
      last_name: "astro",
      city: "Paris",
      country: "France"
    )
    birth_chart.valid?
    positions = SwissEphemerisService.new(birth_chart).call

    planets = positions[:planets]
    planets_positions = planets.map do |planet|
      <<~PLANET_POSITION.strip
        Planet: #{planet[:planet]}
        Longitude: #{planet[:longitude]}
        Zodiac: #{planet[:zodiac]}
        Retrograde: #{planet[:retrograde]}
      PLANET_POSITION
    end.join("\n")

    houses = positions[:houses]
    houses_positions = houses.map do |house|
      <<~HOUSE_POSITION.strip
        House: #{house[:house]}
        Longitude: #{house[:longitude]}
        Zodiac: #{house[:zodiac]}
      HOUSE_POSITION
    end.join("\n")

    chart_points = positions[:chart_points]
    chart_points_positions = chart_points.map do |chart_point|
      <<~CHART_POINT.strip  
        Chart point: #{chart_point[:name]}
        Longitude: #{chart_point[:longitude]}
        Zodiac: #{chart_point[:zodiac]}
      CHART_POINT
    end.join("\n")

    karmic_points = positions[:karmic_points]
    karmic_points_positions = karmic_points.map do |karmic_point|
      <<~KARMIC_POINT.strip
        Karmic point: #{karmic_point[:name]}
        Longitude: #{karmic_point[:longitude]}
        Zodiac: #{karmic_point[:zodiac]}
        Retrograde: #{karmic_point[:retrograde]}
      KARMIC_POINT
    end.join("\n")

    asteroids = positions[:asteroids]
    asteroids_positions = asteroids.map do |asteroid|
      <<~ASTEROID_POSITION.strip
        Asteroid: #{asteroid[:name]}
        Longitude: #{asteroid[:longitude]}
        Zodiac: #{asteroid[:zodiac]}
        Retrograde: #{asteroid[:retrograde]}
      ASTEROID_POSITION
    end.join("\n")

    [
      {
        role: "user",
        content: <<~CURRENT_POSITIONS.strip
          Here are the current positions of the planets in Paris, France :
          #{planets_positions}
        CURRENT_POSITIONS
      },
      {
        role: "user",
        content: <<~CURRENT_POSITIONS.strip
          Here are the current positions of the houses in Paris, France :
          #{houses_positions}
        CURRENT_POSITIONS
      },
      {
        role: "user",
        content: <<~CURRENT_POSITIONS.strip
          Here are the current positions of the chart points in Paris, France :
          #{chart_points_positions}
        CURRENT_POSITIONS
      },
      {
        role: "user",
        content: <<~CURRENT_POSITIONS.strip
          Here are the current positions of the karmic points in Paris, France :
          #{karmic_points_positions}
        CURRENT_POSITIONS
      },
      {
        role: "user",
        content: <<~CURRENT_POSITIONS.strip
          Here are the current positions of the asteroids in Paris, France :
          #{asteroids_positions}
        CURRENT_POSITIONS
      }
    ]
  end

  def function_tools
    [
      {
        type: "function",
        function: {
          name: "create_birth_chart",
          description: "Create a birth chart for a person based on their birth date, time, and location. Birth time is compulsory for accurate astrological calculations. This returns a birth chart object with all the astrological data including planets, houses, chart points, karmic points, and asteroids positions.",
          parameters: {
            type: "object",
            properties: {
              first_name: {
                type: "string",
                description: "The person's first name"
              },
              last_name: {
                type: "string", 
                description: "The person's last name"
              },
              birth_date: {
                type: "string",
                description: "Birth date in YYYY-MM-DD format"
              },
              birth_time: {
                type: "string", 
                description: "Birth time in HH:MM format (24-hour). This is required for accurate chart calculations."
              },
              city: {
                type: "string",
                description: "Birth city"
              },
              country: {
                type: "string",
                description: "Birth country"
              }
            },
            required: ["first_name", "last_name", "birth_date", "birth_time", "city", "country"]
          }
        }
      }
    ]
  end

  def execute_function_call(call)
    case call[:name]
    when "create_birth_chart"
      create_birth_chart_from_function(call[:arguments])
    else
      "Unknown function: #{call[:name]}"
    end
  end

  def create_birth_chart_from_function(arguments_json)
    begin
      args = JSON.parse(arguments_json)
      
      # Validate required fields
      required_fields = ["first_name", "last_name", "birth_date", "birth_time", "city", "country"]
      missing_fields = required_fields.select { |field| args[field].blank? }
      
      if missing_fields.any?
        return "I need all the required information to create an accurate birth chart. Missing: #{missing_fields.map(&:humanize).join(', ')}. Please provide the complete birth details including the exact birth time."
      end
      
      # Validate birth time format
      unless args["birth_time"].match?(/^\d{1,2}:\d{2}$/)
        return "Please provide the birth time in HH:MM format (e.g., '14:30' for 2:30 PM or '09:15' for 9:15 AM)."
      end
      
      # Parse birth datetime
      birth_date = Date.parse(args["birth_date"])
      birth_time = args["birth_time"]
      
      # Create datetime without timezone conversion - use local time as-is
      # This is crucial for accurate birth charts
      birth_datetime = Time.zone.parse("#{birth_date.strftime('%Y-%m-%d')} #{birth_time}")
      
      # Create the birth chart
      birth_chart = @chat_message.user.birth_charts.create!(
        first_name: args["first_name"],
        last_name: args["last_name"], 
        birth: birth_datetime,
        city: args["city"],
        country: args["country"]
      )

      # Wait a moment for the Swiss Ephemeris calculation to complete
      sleep(1)
      
      # Reload to get the calculated positions
      birth_chart.reload
      
      # Build success message with astrological details
      success_message = "✨ I've successfully created a birth chart for #{args['first_name']} #{args['last_name']} born on #{birth_date.strftime('%B %d, %Y')} at #{birth_time} in #{args['city']}, #{args['country']}!\n\n"
      
      # Add comprehensive astrological data if positions are available
      if birth_chart.planet_positions.any?
        success_message += "🌟 **PLANETARY POSITIONS:**\n"
        
        # All planets in order
        all_planets = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
        all_planets.each do |planet_name|
          planet = birth_chart.planet_positions.find_by(planet: planet_name)
          if planet
            retrograde_indicator = planet.retrograde? ? " ℞" : ""
            success_message += "• #{planet_name}: #{planet.zodiac}#{retrograde_indicator}\n"
          end
        end
        
        # Chart points (Ascendant, MC, etc.)
        if birth_chart.chart_points.any?
          success_message += "\n📐 **CHART POINTS:**\n"
          birth_chart.chart_points.each do |point|
            success_message += "• #{point.name}: #{point.zodiac}\n"
          end
        end
        
        # House positions
        if birth_chart.house_positions.any?
          success_message += "\n🏠 **HOUSE CUSPS:**\n"
          birth_chart.house_positions.order(:house).each do |house|
            success_message += "• House #{house.house}: #{house.zodiac}\n"
          end
        end
        
        # Karmic points
        if birth_chart.karmic_points.any?
          success_message += "\n🔮 **KARMIC POINTS:**\n"
          birth_chart.karmic_points.each do |karmic|
            retrograde_indicator = karmic.retrograde? ? " ℞" : ""
            success_message += "• #{karmic.name}: #{karmic.zodiac}#{retrograde_indicator}\n"
          end
        end
        
        # Asteroids
        if birth_chart.asteroid_positions.any?
          success_message += "\n🌌 **ASTEROIDS:**\n"
          birth_chart.asteroid_positions.each do |asteroid|
            retrograde_indicator = asteroid.retrograde? ? " ℞" : ""
            success_message += "• #{asteroid.name}: #{asteroid.zodiac}#{retrograde_indicator}\n"
          end
        end
        
        success_message += "\n✨ This complete birth chart reveals the cosmic blueprint of #{args['first_name']}'s personality, destiny, and life path. Let me provide you with a detailed astrological analysis!"
      else
        success_message += "The planetary positions are being calculated and will be available shortly for detailed analysis."
      end
      
      success_message
      
    rescue JSON::ParserError => e
      "I had trouble parsing the birth chart information. Could you please provide the birth details again?"
    rescue Date::Error => e
      "I couldn't parse the birth date '#{args['birth_date'] rescue 'unknown'}'. Please provide the date in a clear format like 'March 15, 1990' or '1990-03-15'."
    rescue Time::Error, ArgumentError => e
      "I couldn't parse the birth time '#{args['birth_time'] rescue 'unknown'}'. Please provide the time in HH:MM format (e.g., '14:30' for 2:30 PM)."
    rescue ActiveRecord::RecordInvalid => e
      "I couldn't create the birth chart: #{e.record.errors.full_messages.join(', ')}. Please check the information and try again."
    rescue => e
      Rails.logger.error "Birth chart creation error: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      "I encountered an error while creating the birth chart. Please try again with the birth information."
    end
  end
end
