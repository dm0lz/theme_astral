class SearchEngine::QueryService < BaseService
  def initialize(search_engine: "duckduckgo", country: "us", pages_number: 10, options: "{}")
    @search_engine = search_engine
    @country = country
    @pages_number = pages_number
    # @options = search_engine == "google" ? "{}" : %Q({headless: true, proxy: {server: "pr.oxylabs.io:7777", username: "customer-#{Rails.application.credentials[:proxy_username]}-cc-#{country.upcase}-sessid-#{rand(36**10).to_s(36).slice(2..-1)}-sesstime-1440", password: "#{Rails.application.credentials[:proxy_password]}"}})
    @options = "{}"
  end
  def call(query)
    if @search_engine == "google"
      SearchEngine::Provider::GoogleService.new(country: @country, pages_number: @pages_number, options: @options).call(query)
    else
      "SearchEngine::Provider::#{@search_engine.capitalize}Service".constantize.new(pages_number: @pages_number, options: @options).call(query)
    end
    # serp.reject { |ser| ser.any? { |_, value| value == "N/A" } }
  end
end
