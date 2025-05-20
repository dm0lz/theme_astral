class Public::ContactsController < ApplicationController
  def create
    @contact = Contact.new(contact_params)
    
    respond_to do |format|
      if @contact.save
        ContactMailer.new_contact_notification(@contact).deliver_later

        format.html do
          redirect_to root_path, notice: "Merci pour votre message. Nous vous contacterons dans les plus brefs délais."
        end

        format.turbo_stream do
          render turbo_stream: [
            turbo_stream.replace(
              "contact-form",
              partial: "public/landing_page/form",
              locals: { contact: Contact.new }
            ),
            turbo_stream.replace(
              "form-messages",
              partial: "public/landing_page/form_message",
              locals: { 
                type: "success",
                message: "Merci pour votre message. Nous vous contacterons dans les plus brefs délais."
              }
            )
          ]
        end
      else
        format.html do
          redirect_to root_path, alert: "Une erreur est survenue lors de la soumission de votre demande. Veuillez réessayer."
        end

        format.turbo_stream do
          render turbo_stream: [
            turbo_stream.replace(
              "contact-form",
              partial: "public/landing_page/form",
              locals: { contact: @contact }
            ),
            turbo_stream.replace(
              "form-messages",
              partial: "public/landing_page/form_message",
              locals: { 
                type: "error",
                message: @contact.errors.full_messages.join(", ")
              }
            )
          ]
        end
      end
    end
  end

  private

  def contact_params
    params.require(:contact).permit(:name, :email, :message, :birth_datetime, :birthplace, :consultation_type, :consultation_datetime)
  end
end
