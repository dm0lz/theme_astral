class SearchEngine::DomainEmailsFinderService < BaseService
  def initialize(search_engine: "duckduckgo", pages_number: 5)
    @search_engine = search_engine
    @pages_number = pages_number
  end
  def call(domain_name)
    serp_web_pages = SearchEngine::WebPagesService.new(search_engine: @search_engine, pages_number: @pages_number).call("inbody%3A*%40#{domain_name}")
    serp_web_pages.join(" ").scan(/\b[A-Za-z0-9._%+-]+@#{Regexp.escape(domain_name)}\b/i).uniq rescue nil
  end
end
