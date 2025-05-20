class Social::X::BotSeleniumService < BaseService
  def initialize(search)
    @twitter_username = Rails.application.credentials[:x_username]
    @twitter_password = Rails.application.credentials[:x_password]
    @scroll_iteration = 10
    @search = search
    @driver = init_driver
    @wait = Selenium::WebDriver::Wait.new(timeout: 10)
  end

  def tweet(payload)
    login
    twitter_search(@search)
    tweets_urls = scroll_twitter_search(@scroll_iteration)
    logger.info("Replying to #{tweets_urls.count} tweets found based on keywords : #{@search}...")
    tweets_urls.each { |url| tweet_reply(url, payload) }
  rescue StandardError => e
    logger.info(e)
  ensure
    @driver.quit
  end

  def mass_follow
    login
    twitter_search(@search)
    tweets_urls = scroll_twitter_search(@scroll_iteration)
    tweets_authors = tweets_urls.map { |l| l.split("/status/").first }.uniq
    logger.info("Following #{tweets_authors.count} individuals")
    tweets_authors.each { |url| follow(url) }
  rescue StandardError => e
    logger.info(e)
  ensure
    @driver.quit
  end

  private

  def init_driver
    options = Selenium::WebDriver::Chrome::Options.new
    # options.add_argument("--headless")
    driver = Selenium::WebDriver.for(:chrome, options: options)
    driver.manage.timeouts.script_timeout = 60
    driver.manage.timeouts.page_load = 60
    driver
  end

  def login
    @driver.get("https://twitter.com/i/flow/login")
    element = @wait.until { @driver.find_element(:name, "text") }
    element.send_keys(@twitter_username)
    element.send_keys :enter
    element = @wait.until { @driver.find_element(:name, "password") }
    element.send_keys(@twitter_password)
    element.send_keys :enter
  end

  def twitter_search(keywords)
    element = @wait.until { @driver.find_element(css: '[role="combobox"]') }
    element.send_keys(keywords)
    element.send_keys(:enter)
    sleep(1)
  end

  def extract_tweets_paths
    elements = @wait.until { @driver.find_elements(css: '[data-testid="cellInnerDiv"]') }
    elements.map do |element|
      html = element.attribute("innerHTML")
      regex = /<a\s+[^>]*href=["'](.*?)["']/
      paths = html.scan(regex)
      paths.flatten.select { |l| l.include?("/status/") }.select { |l| l.split("/").count == 4 }
    rescue StandardError => e
      puts(e)
      nil
    end
  end

  def scroll_twitter_search(iterations)
    links = []
    iterations.times do
      links << extract_tweets_paths
      @driver.action.scroll_by(0, 500).perform
      sleep(0.25)
    end
    links.flatten.compact.uniq.map { |l| "https://twitter.com#{l}" }
  end

  def tweet_reply(url, payload)
    @driver.get(url)
    element = @wait.until { @driver.find_element(css: '[data-text="true"]') }
    @driver.action.scroll_by(0, 600).perform
    element.send_keys(payload)
    # @driver.execute_script('arguments[0].scrollIntoView(true);', element)
    # @driver.action.scroll_by(0, 200).perform
    element = @wait.until { @driver.find_element(css: '[data-testid="tweetButtonInline"]') }
    # @driver.action.scroll_by(0, 200).perform
    element.click
    sleep(1)
  rescue StandardError => e
    puts(e)
  end

  def follow(url)
    @driver.get(url)
    element = @wait.until { @driver.find_element(:xpath, "//button[contains(@aria-label, 'Follow')]") }
    element.click
  end
end
