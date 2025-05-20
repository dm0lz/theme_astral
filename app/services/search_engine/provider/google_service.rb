class SearchEngine::Provider::GoogleService < BaseService
  def initialize(country: "us", pages_number: 10, options: "{}")
    @country = country
    @pages_number = pages_number
    @options = options
  end

  def call(query)
    url = URI("http://#{ENV.fetch('GOOGLE_SERP_HOST', 'localhost:3001')}/api/search/#{@country}?q=#{query}&pages=#{@pages_number}")
    response = Net::HTTP.get(url)
    data = JSON.parse(response)
    data.is_a?(Array) ? data.map { |serp| serp["search_results"] }.flatten : data
  end
end
