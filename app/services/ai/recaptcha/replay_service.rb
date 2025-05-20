class Ai::Recaptcha::ReplayService < BaseService
  def initialize(recaptcha_challenge)
    @recaptcha_challenge = recaptcha_challenge
  end

  def call
    case @recaptcha_challenge.challenge
    when "image_classification_challenge"
      Ai::Recaptcha::ImageClassificationService.new(
        img_base64: @recaptcha_challenge.img_base64,
        tiles_nb: @recaptcha_challenge.tiles_nb,
        keyword: @recaptcha_challenge.keyword
      ).call
    when "images_classification_challenge"
      Ai::Recaptcha::ImagesClassificationService.new(
        base64_images: @recaptcha_challenge.base64_images,
        tiles_nb: @recaptcha_challenge.tiles_nb,
        keyword: @recaptcha_challenge.keyword
      ).call
    when "object_localization_challenge"
      Ai::Recaptcha::ObjectLocalizationService.new(
        img_base64: @recaptcha_challenge.img_base64,
        tiles_nb: @recaptcha_challenge.tiles_nb,
        keyword: @recaptcha_challenge.keyword
      ).call
    else
      raise "Unknown challenge type"
    end
  end
end
