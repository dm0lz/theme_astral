class Public::LandingPageController < ApplicationController
  def index
    @contact = Contact.new
  end
end
