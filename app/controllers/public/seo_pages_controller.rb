class Public::SeoPagesController < Public::ApplicationController
  def show
    @seo_page = SeoPage.find_by(slug: params[:id])
    @contact = Contact.new
  end
end