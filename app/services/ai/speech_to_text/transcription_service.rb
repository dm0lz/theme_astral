class Ai::SpeechToText::TranscriptionService < BaseService
  def initialize(audio_url:)
    @url = audio_url
  end

  def call
    mutex = Mutex.new
    mutex.synchronize do
      puts(python_script)
      RuntimeExecutor::PythonService.new.call(python_script)
    end
  end

  private

  def python_script
    <<-PYTHON
      import json
      import requests
      import tempfile
      import os
      from transformers import pipeline

      response = requests.get("#{@url}", stream=True)
      response.raise_for_status()

      with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_audio:
          for chunk in response.iter_content(chunk_size=8192):
              temp_audio.write(chunk)
          temp_path = temp_audio.name

      pipe = pipeline("automatic-speech-recognition", model="openai/whisper-small")
      output = pipe(temp_path)
      os.remove(temp_path)

      print(json.dumps(output, indent=2))
    PYTHON
  end
end
