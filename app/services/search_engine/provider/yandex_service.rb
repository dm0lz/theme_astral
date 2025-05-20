class SearchEngine::Provider::YandexService < BaseService
  def initialize(pages_number: 10, options: "{slowMo: 650}")
    @pages_number = pages_number
    @options = options.gsub("\\", "")
  end
  def call(query)
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
          next: document.querySelector(".Pager-Item_type_next")?.getAttribute("href"),
          serp_url: document.location.href,
          search_results: [...document.querySelectorAll("div > ul > li")].map((article, index) => ({
            site_name: article.querySelector(".organic__path")?.textContent?.trim() || "N/A",
            url: article.querySelector(".OrganicTitle-Link")?.getAttribute("href") || "N/A",
            title: article.querySelector(".OrganicTitle-LinkText")?.textContent?.trim() || "N/A",
            description: article.querySelector(".OrganicTextContentSpan")?.textContent?.trim() || "N/A",
            position: positionOffset + index + 1
          }))
        };
      };
      (async () => {
        const browser = await chromium.launch(#{@options});
        const page = await browser.newPage();
        await page.goto("https://www.yandex.com/search?text=#{query}");
        const results = [];
        let positionOffset = 0;
        while (true) {
          const data = await page.evaluate(run_script, positionOffset);
          results.push(data);
          positionOffset += data.search_results.length;
          if (!data.next || positionOffset / 10 >= #{@pages_number}) {
            break;
          }
          await page.goto("https://www.yandex.com" + data.next);
        }
        console.log(JSON.stringify(results));
        await browser.close();
      })();
    JS
  end
end
