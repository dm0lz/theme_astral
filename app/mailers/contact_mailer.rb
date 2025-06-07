class ContactMailer < ApplicationMailer
  def new_contact_notification(contact)
    @contact = contact
    mail(
      to: ["ducrouxolivier@gmail.com", "arianejonker.fr@gmail.com"], # Replace with your email
      subject: "New Contact Form Submission from #{contact.name}"
    )
  end
end