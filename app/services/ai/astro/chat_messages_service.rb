class Ai::Astro::ChatMessagesService
  def initialize(chat_message)
    @chat_message = chat_message
  end

  def call
    client = OpenAI::Client.new(access_token: Rails.application.credentials.openai_api_key, uri_base: "https://api.openai.com/v1")
		response = client.chat(
			parameters: {
				model: "gpt-4o",
				response_format: {
					type: "json_schema",
					json_schema: response_schema
				},
				messages: [ { role: "system", content: system_prompt } ] + chat_history + [ { role: "user", content: user_prompt } ],
			}
		)
		json = JSON.parse(response["choices"][0]["message"]["content"].match(/{.*}/m).to_s) rescue nil
    json["chat_message"]
  end

  private

  def user_prompt
    <<~PROMPT.strip
      
      Here are the birthcharts for the user along with their planet positions, house positions, and chart points: #{birth_charts}
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

  def response_schema
    {
      strict: true,
      name: "chat_message_response",
      description: "Generate a concise and insightful astrology-related chat message response.",
      schema: {
        type: "object",
        properties: {
          chat_message: {
            type: "string",
            description: "The generated response to the user's astrology-related message"
          }
        },
        additionalProperties: false,
        required: ["chat_message"]
      }
    }
  end

  def birth_charts
    @chat_message.user.birth_charts.map do |birth_chart|
      <<~BIRTH_CHART.strip
        First name: #{birth_chart.first_name}
        Last name: #{birth_chart.last_name}
        Date of birth: #{birth_chart.birth}
        Place of birth: #{birth_chart.location}
        Latitude: #{birth_chart.latitude}
        Longitude: #{birth_chart.longitude}
        City: #{birth_chart.city}
        Country: #{birth_chart.country}
        Planet positions: #{birth_chart_positions(birth_chart)}
        House positions: #{birth_chart_positions(birth_chart)}
        Chart points: #{birth_chart_positions(birth_chart)}
      BIRTH_CHART
    end.join("\n")
  end

  def birth_chart_positions(birth_chart)
    birth_chart.planet_positions.map do |planet_position|
      <<~PLANET_POSITION.strip
        Planet: #{planet_position.planet}
        Longitude: #{planet_position.longitude}
        Zodiac: #{planet_position.zodiac}
      PLANET_POSITION
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
end
