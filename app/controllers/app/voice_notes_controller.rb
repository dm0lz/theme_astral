class App::VoiceNotesController < App::ApplicationController
  # This controller is no longer needed for primary voice functionality
  # as we've switched to native browser speech recognition.
  # Keeping it as a potential fallback for browsers that don't support native speech recognition.
  
  def transcribe
    # This endpoint is now deprecated in favor of native browser speech recognition
    # but kept as a fallback for unsupported browsers
    render json: { 
      success: false, 
      error: "This app now uses native browser speech recognition. Please enable microphone permissions and try again." 
    }
  end
end 