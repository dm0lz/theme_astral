class SearchEngine::Provider::DuckduckgoService < BaseService
  def initialize(pages_number: 10, options: "{}")
    @pages_number = pages_number.to_i - 1
    @options = options.gsub("\\", "")
  end
  def call(query)
    url = "https://duckduckgo.com/?t=h_&q=#{query.gsub("'", "")}"
    serp = Scraper::PageEvaluatorService.new(url, @options).call(js_code)
    serp["search_results"] rescue nil
  end

  private
  def js_code
    <<-JS
      const loadMorePromises = [...Array(#{@pages_number})].map(async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, i * 500));
        const moreResultsButton = document.querySelector("#more-results");
        if (!moreResultsButton) return;
        moreResultsButton.click();
        await new Promise(resolve => setTimeout(resolve, 200));
        document.documentElement.scroll({ top: document.documentElement.scrollHeight });
      });
      return Promise.all(loadMorePromises).then(() => {
        return {
          serp_url: document.location.href,
          search_results: [...document.querySelectorAll("ol > li > article")].map((article, index) => ({
            site_name: article.querySelector("article > div:nth-child(2) p")?.textContent?.trim() || "N/A",
            url: article.querySelector("article > div:nth-child(3) a")?.getAttribute("href") || "N/A",
            title: article.querySelector("article > div:nth-child(3) h2")?.textContent?.trim() || "N/A",
            description: article.querySelector("article > div:nth-child(4) div")?.textContent?.trim() || "N/A",
            position: index + 1
          }))
        }
      });
    JS
  end
end
