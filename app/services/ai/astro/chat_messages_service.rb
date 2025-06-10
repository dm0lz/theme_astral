class Ai::Astro::ChatMessagesService
  def initialize(chat_message)
    @chat_message = chat_message
  end

  def call
    client = OpenAI::Client.new(access_token: Rails.application.credentials.deep_seek_api_key, uri_base: "https://api.deepseek.com")
    response = ""
    buffer = ""
		client.chat(
			parameters: {
				model: "deepseek-chat",
				messages: [ { role: "system", content: system_prompt } ] + prompt_messages,
        stream: proc do |chunk, _bytesize|
          delta = chunk.dig("choices", 0, "delta", "content")
          next unless delta
          response += delta
          buffer += delta
          # if buffer contains a sentence ending, send it to the client
          if buffer.match(/[.!?]\s*$/)
            # remove all icons like  ✨, 🌟, 🌈, etc.
            buffer = buffer.gsub(/[\u{1F600}-\u{1F64F}\u{2728}\u{1F319}\u{1F52E}]/, '')
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
          sleep 0.05
        end
			}
		)
		# response["choices"][0]["message"]["content"]
    chat_message = ChatMessage.create!(user_id: @chat_message.user_id, body: response, author: "assistant")
    Turbo::StreamsChannel.broadcast_replace_to(
      "streaming_channel_#{@chat_message.user_id}",
      target: "temp_message",
      partial: "app/chat_messages/chat_message",
      locals: { chat_message: chat_message }
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
      You are a professional astrologer with deep knowledge of natal charts, planetary transits, zodiac signs, and astrological compatibility.

      Your goal is to provide engaging, accurate, and easy-to-understand replies to user messages. 
      Tailor each response to sound warm, intuitive, and insightful—like a caring human astrologer, not a robot.

      Keep your reply relevant to the user's message. Be concise, but add meaningful insight. Avoid generic or vague responses.
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

  def chat_history
    ChatMessage.where(user_id: @user_id).order(created_at: :asc).map do |msg|
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
      }
    ]
  end
end
