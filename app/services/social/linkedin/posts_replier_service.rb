# topic = Ai::Seo::KeywordsService.new.keywords.sample
# tweets = (0..30).to_a.map{|l| Social::X::TweetGeneratorService.new(topic).call}
# Social::Linkedin::PostsReplierService.new(topic, tweets).call
class Social::Linkedin::PostsReplierService < BaseService
  def initialize(query, payload, options = "{headless: false}")
    @query = query
    @payload = payload
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
        await page.goto("https://www.linkedin.com/uas/login");
        await page.fill("input#username", "#{Rails.application.credentials[:linkedin_email]}");
        await page.fill("input#password", "#{Rails.application.credentials[:linkedin_password]}");
        const sign_in_button = await page.waitForSelector(
          '[data-litms-control-urn="login-submit"]'
        );
        await sign_in_button.click();
        await page.goto(
          "https://www.linkedin.com/search/results/content/?keywords=#{@query}"
        );
        await page.waitForSelector('[role="combobox"]');
        
        let list_items = await page.$$('ul[role="list"] > li');
        const reply = async (list_items) => {
          for (const [index, list_item] of list_items.entries()) {
          try {
            const comment_button = await list_item.$(
              ".social-actions-button.comment-button"
            );
            const is_disabled = await comment_button.evaluate(el => el.disabled);
            if (comment_button && !is_disabled) {
              await comment_button.scrollIntoViewIfNeeded();
              await comment_button.click();
              const text_editor = await list_item.$(".ql-editor");
              await text_editor.click();
              const payloads = #{@payload};
              const random = Math.floor(Math.random() * #{@payload.length});
              const payload = payloads[random];
              await text_editor.fill(`${payload}`);
              const button = await page.waitForSelector(
                "form > div > div > div > div > button"
              );
              const submit_button = await list_item.$("form > div > div > div > div > button");
              await submit_button.click();
              await page.waitForTimeout(2000);
            }
            } catch (error) {
              console.log(error);
            }
          }
        }
        await reply(list_items);

        while (true) {
          let i = 0;
          do {
            await page.mouse.wheel(0, 1000);
            await page.waitForTimeout(2000);
            i += 1;
          } while (i < 5);
          const all_items = await page.$$('ul[role="list"] > li');
          console.log("all_items", all_items.length);
          const all_texts = await Promise.all(all_items.map(async (item) => {
            const element = await item.$(".feed-shared-inline-show-more-text");
            if (element) {
              const text = await element.evaluate(el => el.textContent);
              return text.trim(); // optional: trim whitespace
            }
            return null; // or filter it out later
          }));
          const previous_text = await Promise.all(list_items.map(async (item) => {
            try {
              const element = await item.$(".feed-shared-inline-show-more-text");
              if (element) {
                const text = await element.evaluate(el => el.textContent.trim());
                return text;
              }
            } catch (e) {
              console.log("Error in previous_text extraction:", e);
            }
            return null;
          }));
          const filtered_previous_text = previous_text.filter(text => text !== null);
          list_items = all_items;
          const pending_items = [];
          for (let i = 0; i < all_items.length; i++) {
            const text = all_texts[i];
            if (!previous_text.includes(text)) {
              pending_items.push(all_items[i]);
              previous_text.push(text);
            }
          }
          await reply(pending_items);
          await page.waitForTimeout(Math.floor(Math.random() * 60000) + 60000);
        }
        
        await browser.close();
      })();
    JS
  end
end
