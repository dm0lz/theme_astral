class Social::Facebook::PostsReplierService < BaseService
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
        await page.setDefaultTimeout(60000);

        await page.goto("https://www.facebook.com/login.php");
        await page.evaluate(() => {
          const rejectCookiesBtn = document.querySelector('[aria-label="Refuser les cookies optionnels"]');
          if (rejectCookiesBtn) rejectCookiesBtn.click();
        });

        await page.fill("input#email", "#{Rails.application.credentials[:facebook_email]}");
        await page.fill("input#pass", "#{Rails.application.credentials[:facebook_password]}");
        const signInBtn = await page.waitForSelector("button#loginbutton");
        await signInBtn.click();

        await page.waitForSelector('input[role="combobox"]');
        await page.goto("https://www.facebook.com/search/posts/?q=#{@query}");

        const payloads = #{@payload};
        const previousTexts = new Set();

        const replyToPosts = async (commentButtons) => {
          for (const button of commentButtons) {
            try {
              await button.scrollIntoViewIfNeeded();
              await button.click();
              const editable = await page.waitForSelector('div[role="textbox"][contenteditable="true"]', { timeout: 5000 });
              await editable.click();
              const randomIndex = Math.floor(Math.random() * payloads.length);
              await editable.fill(payloads[randomIndex]);
              const submit = await page.waitForSelector('div[aria-label="Commenter"]', { timeout: 5000 });
              await submit.click();
              const groupCheckbox = await page.$('[name="agree-to-group-rules"]');
              if (groupCheckbox) {
                await groupCheckbox.click();
                const groupSubmit = await page.waitForSelector('[aria-label="Envoyer"]');
                await groupSubmit.click();
              }
              await page.waitForTimeout(2000);
              const closeButton = await page.$('div[aria-label="Fermer"]');
              if (closeButton) await closeButton.click();
            } catch (err) {
              console.log("Reply error:", err.message);
            }
          }
        };

        while (true) {
          await page.mouse.wheel(0, 1000);
          await page.waitForTimeout(2000);

          const commentButtons = await page.$$('[aria-label="Laissez un commentaire"]');
          const commentContainers = await Promise.all(commentButtons.map(btn => btn.evaluateHandle(el => el.closest('div[role="article"]'))));
          
          const pendingButtons = [];
          for (let i = 0; i < commentContainers.length; i++) {
            const container = commentContainers[i];
            if (!container) continue;
            try {
              const textContent = await container.evaluate(el => el.innerText);
              if (textContent && !Array.from(previousTexts).includes(textContent)) {
                previousTexts.add(textContent);
                pendingButtons.push(commentButtons[i]);
              }
            } catch (e) {
              console.log("Text extraction error:", e.message);
            }
          }

          await replyToPosts(pendingButtons);
          await page.waitForTimeout(2000);
        }

        await browser.close();
      })();
    JS
  end
end