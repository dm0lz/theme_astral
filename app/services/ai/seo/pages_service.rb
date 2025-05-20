class Ai::Seo::PagesService < BaseService
  def initialize(type)
    case type
    when "cluster"
      @is_long_tail = true
    when "pillar"
      @is_long_tail = false
    else
      raise ArgumentError, "Invalid type: #{type}"
    end
  end

  def call
    Keyword.where(is_long_tail: @is_long_tail).each do |keyword|
      CreateSeoPageJob.perform_later(keyword)
    end
  end
end