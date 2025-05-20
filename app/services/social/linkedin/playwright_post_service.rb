class Social::Linkedin::PlaywrightPostService < BaseService
  def initialize(options = "{headless: false}")
    @options = options.gsub("\\", "")
  end

  def call
    topic = Ai::Seo::KeywordsService.new.keywords.sample
    post = Social::Linkedin::PostGeneratorService.new(topic).call
    puts js_code(post)
    RuntimeExecutor::NodeService.new.call(js_code(post))
  end

  private
  def js_code(post)
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
          "https://www.linkedin.com/feed/"
        );
        const feed_entry = await page.waitForSelector(
          '.share-box-feed-entry__top-bar > button'
        );
        await feed_entry.click();
        await page.waitForSelector('.ql-container');
        const ql_container = await page.waitForSelector('.ql-container');
        await ql_container.click();
        await page.type('.ql-container', `#{post}`);
        const publish_button = await page.waitForSelector(
          '.share-actions__primary-action.artdeco-button.artdeco-button--2.artdeco-button--primary.ember-view'
        );
        await publish_button.click();
        await page.waitForTimeout(5000);
        await browser.close();
      })();
    JS
  end
end