class Ai::Openai::ChatGptService < BaseService
	def call(user_prompt:, system_prompt:, response_schema:)
		client = OpenAI::Client.new(access_token: Rails.application.credentials.openai_api_key, uri_base: "https://api.openai.com/v1")
		response = client.chat(
			parameters: {
				model: "gpt-4.1-nano",
				response_format: {
					type: "json_schema",
					json_schema: response_schema
				},
				messages: [
					{ role: "system", content: system_prompt },
					{ role: "user", content: user_prompt }
				],
				# temperature: 0.2
			}
		)
		JSON.parse(response["choices"][0]["message"]["content"].match(/{.*}/m).to_s) rescue nil
	end
end
  