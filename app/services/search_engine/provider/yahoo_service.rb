class SearchEngine::Provider::YahooService < BaseService
  def initialize(pages_number: 10, options: "{}")
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
          next: document.querySelector("a.next")?.getAttribute("href"),
          serp_url: document.location.href,
          search_results: [...document.querySelectorAll("div > ol > li")]
            .slice(3).slice(0, -1)
            .map((article, index) => ({
              site_name:
                article.querySelector(".d-ib.p-abs")?.textContent?.trim() ||
                "N/A",
              url:
                article.querySelector("h3 > a")?.getAttribute("href") ||
                "N/A",
              title:
                article.querySelector("h3 > a")?.textContent?.trim() ||
                "N/A",
              description:
                article.querySelector("div > div > p")?.textContent?.trim() ||
                "N/A",
              position: positionOffset + index + 1,
            })),
        };
      };
      (async () => {
        const browser = await chromium.launch(#{@options});
        const page = await browser.newPage();
        await page.goto("https://search.yahoo.com/search?p=#{query}");
        await page.click(".accept-all");
        await page.waitForSelector("div > ol > li", { timeout: 5000 });
        const results = [];
        let positionOffset = 0;
        do {
          const data = await page.evaluate(run_script, positionOffset);
          results.push(data);
          positionOffset += data.search_results.length;
          if (!data.next || positionOffset / 7 >= #{@pages_number}) {
            break;
          }
          await page.goto(data.next);
          await page.waitForSelector("div > ol > li", { timeout: 5000 });
        } while (true);
        console.log(JSON.stringify(results));
        await browser.close();
      })();
    JS
  end
end
