class Public::LandingPageController < Public::ApplicationController
  def index
    @contact = Contact.new
  end
end
