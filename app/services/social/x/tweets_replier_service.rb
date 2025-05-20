# topic = Ai::Seo::KeywordsService.new.keywords.sample
# tweets = (0..30).to_a.map{|l| Social::X::TweetGeneratorService.new(topic).call}
# Social::X::TweetsReplierService.new(topic, tweets).call
class Social::X::TweetsReplierService < BaseService
  def initialize(search, payloads, options = "{headless: false}")
    @search = search
    @payloads = payloads
    @options = options.gsub("\\", "")
  end

  def call
    puts js_code
    RuntimeExecutor::NodeService.new.call(js_code)
  end

  private

  def js_code
    <<-JS
      const { chromium } = require("playwright-extra");
      const stealth = require("puppeteer-extra-plugin-stealth")();
      chromium.use(stealth);
      (async () => {
        const browser = await chromium.launch(#{@options});
        const page = await browser.newPage();

        // Login to Twitter
        await page.goto("https://twitter.com/i/flow/login");
        await page.fill("input[name='text']", "#{Rails.application.credentials[:x_username]}");
        await page.keyboard.press("Enter");
        await page.waitForSelector("input[name='password']");
        await page.fill("input[name='password']", "#{Rails.application.credentials[:x_password]}");
        await page.keyboard.press("Enter");

        // Search
        await page.waitForSelector('[role="combobox"]');
        await page.fill('[role="combobox"]', "#{@search}");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3000);

        const repliedLinks = new Set();

        const extractLinks = async () => {
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('article a[href*="/status/"]')).map(a =>
              "https://twitter.com" +
              a.getAttribute("href").split("/status/")[0] +
              "/status/" +
              a.getAttribute("href").split("/status/")[1].split("/")[0]
            );
          });
          // Deduplicate using JS Set and filter out already replied
          return [...new Set(links)].filter(link => !repliedLinks.has(link));
        };

        const replyToLinks = async (links) => {
          for (const link of links) {
            try {
              await page.goto(link);
              const textArea = await page.waitForSelector('[data-contents="true"]', { timeout: 5000 });
              await textArea.click();
              const payloads = #{@payloads};
              const random = Math.floor(Math.random() * payloads.length);
              const payload = payloads[random];
              await textArea.fill(payload);

              await page.evaluate(() => {
                const spans = document.querySelectorAll("span");
                const tweetButton = Array.from(spans).find(
                  (span) => span.textContent.trim() === "Reply"
                );
                if (tweetButton) {
                  tweetButton.scrollIntoView();
                  tweetButton.click();
                }
              });

              repliedLinks.add(link);
              await page.waitForTimeout(Math.floor(Math.random() * 60000) + 60000);
            } catch (err) {
              console.log("Reply error:", err);
            }
          }
        };

        for (let i = 0; i < 50; i++) {
          const y = Math.floor(Math.random() * 2000) + 1000;
          await page.mouse.wheel(0, y);
          await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1000);
        }

        const links = await extractLinks();
        await replyToLinks(links);

        await browser.close();
      })();
    JS
  end
end