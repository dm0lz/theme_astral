
class SearchEngine::CompanyDomainFinderService < BaseService
  def initialize(search_engine: "duckduckgo", pages_number: 5)
    @search_engine = search_engine
    @pages_number = pages_number
  end
  def call(company_name)
    results = SearchEngine::QueryService.new(search_engine: @search_engine, pages_number: @pages_number).call(company_name)
    domain = Ai::SerpDomainFinderService.new.call(results)
    domain.downcase
  end
end
