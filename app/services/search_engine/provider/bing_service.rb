class SearchEngine::Provider::BingService < BaseService
  def initialize(pages_number: 1, options: "{}")
    @pages_number = pages_number.to_i
    @options = options.gsub("\\", "")
  end
  def call(query)
    puts js_code(query)
    serps = RuntimeExecutor::NodeService.new.call(js_code(query))
    serps.map { |serp| serp["search_results"] }.flatten
  end

  private
  def js_code(query)
    <<-JS
      const { chromium } = require("playwright-extra");
      const stealth = require("puppeteer-extra-plugin-stealth")();
      chromium.use(stealth);
      const run_script = (positionOffset) => {
        return {
          next: [...document.querySelectorAll("ol > li > nav > ul > li")][[...document.querySelectorAll("ol > li > nav > ul > li")].length-1]?.querySelector("a")?.getAttribute("href"),
          serp_url: document.location.href,
          search_results: [...document.querySelectorAll("ol > li")].map((article, index) => ({
            site_name: article.querySelector("div > a > div:nth-child(2) > div")?.textContent?.trim() || "N/A",
            url: article.querySelector("h2 > a")?.getAttribute("href") || "N/A",
            title: article.querySelector("h2")?.textContent?.trim() || "N/A",
            description: article.querySelector("p")?.textContent?.trim() || "N/A",
            position: positionOffset + index + 1
          }))
        };
      };
      (async () => {
        const browser = await chromium.launch(#{@options});
        const page = await browser.newPage();
        await page.goto("https://www.bing.com/search?q=#{query}");
        const results = [];
        let positionOffset = 0;
        let pageNb = 0;
        while (true) {
          pageNb += 1;
          const data = await page.evaluate(run_script, positionOffset);
          results.push(data);
          positionOffset += data.search_results.length;
          if (!data.next || pageNb >= #{@pages_number}) {
            break;
          }
          await page.goto("https://www.bing.com" + data.next);
        }
        console.log(JSON.stringify(results));
        await browser.close();
      })();
    JS
  end
end
