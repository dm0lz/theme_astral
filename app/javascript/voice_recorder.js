class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.maxDuration = 120000; // 2 minutes max
    this.recordingTimer = null;
    this.recordingStartTime = null;
  }

  async initialize() {
    try {
      // Check if browser supports audio recording
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording');
      }

      const constraints = { 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          sampleSize: 16,
          channelCount: 1
        }
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return true;
    } catch (error) {
      console.error('Error initializing voice recorder:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone permission denied. Please enable microphone access in your browser settings.');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Audio recording not supported. Please use a compatible browser.');
      }
      
      throw error;
    }
  }

  async startRecording() {
    if (this.isRecording) return;

    try {
      // Always re-initialize the stream for each recording session
      await this.initialize();

      this.audioChunks = [];
      
      // Try different MIME types in order of preference
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav',
        'audio/mp3'
      ];
      
      let selectedMimeType = null;
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop();
      };

      this.mediaRecorder.start(1000); // 1 second timeslice
      
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Start timer display
      this.startTimer();

      // Auto-stop after max duration
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, this.maxDuration);

      this.updateUI('recording');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopTimer();
      this.updateUI('processing');
      
      // Stop the microphone stream immediately
      this.stopStream();
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.stopStream();
      this.updateUI('ready');
    }
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }
  }

  handleRecordingStop() {
    const audioBlob = new Blob(this.audioChunks, { 
      type: this.mediaRecorder.mimeType || 'audio/webm' 
    });
    
    // Validate blob size
    if (audioBlob.size === 0) {
      console.error('Audio blob is empty!');
      this.onTranscriptionError('Recording failed - no audio data captured');
      return;
    }
    
    this.transcribeAudio(audioBlob);
  }

  async transcribeAudio(audioBlob) {
    try {
      const formData = new FormData();
      
      // Use appropriate file extension based on the blob type
      let fileName = 'recording.webm'; // Default
      if (audioBlob.type.includes('mp4')) {
        fileName = 'recording.mp4';
      } else if (audioBlob.type.includes('wav')) {
        fileName = 'recording.wav';
      } else if (audioBlob.type.includes('mp3') || audioBlob.type.includes('mpeg')) {
        fileName = 'recording.mp3';
      } else if (audioBlob.type.includes('ogg')) {
        fileName = 'recording.ogg';
      }
      
      formData.append('audio', audioBlob, fileName);

      // Get CSRF token
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

      const response = await fetch('/app/voice_notes/transcribe', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.onTranscriptionComplete(result.transcription);
      } else {
        this.onTranscriptionError(result.error || 'Failed to transcribe audio');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      this.onTranscriptionError('Network error occurred while transcribing audio');
    }
  }

  onTranscriptionComplete(transcription) {
    // This will be overridden by the form implementation
    console.log('Transcription:', transcription);
  }

  onTranscriptionError(error) {
    // This will be overridden by the form implementation
    console.error('Transcription error:', error);
  }

  startTimer() {
    const timerElement = document.getElementById('recording-timer');
    if (!timerElement) return;

    this.recordingTimer = setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      
      timerElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  stopTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  updateUI(state) {
    const voiceButton = document.getElementById('voice-record-btn');
    const statusText = document.getElementById('voice-status');
    const recordingIndicator = document.getElementById('recording-indicator');
    const timerElement = document.getElementById('recording-timer');

    if (!voiceButton) return;

    switch (state) {
      case 'recording':
        voiceButton.querySelector('.record-icon').classList.add('hidden');
        voiceButton.querySelector('.stop-icon').classList.remove('hidden');
        voiceButton.classList.add('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
        voiceButton.classList.remove('bg-amber-600', 'hover:bg-amber-700');
        
        if (statusText) statusText.textContent = 'Recording... Tap to stop';
        if (recordingIndicator) recordingIndicator.classList.remove('hidden');
        if (timerElement) timerElement.classList.remove('hidden');
        break;

      case 'processing':
        voiceButton.querySelector('.record-icon').classList.remove('hidden');
        voiceButton.querySelector('.stop-icon').classList.add('hidden');
        voiceButton.classList.remove('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
        voiceButton.classList.add('bg-amber-600', 'hover:bg-amber-700');
        voiceButton.disabled = true;
        
        if (statusText) statusText.textContent = 'Processing your voice note...';
        if (recordingIndicator) recordingIndicator.classList.add('hidden');
        if (timerElement) timerElement.classList.add('hidden');
        break;

      case 'ready':
      default:
        voiceButton.querySelector('.record-icon').classList.remove('hidden');
        voiceButton.querySelector('.stop-icon').classList.add('hidden');
        voiceButton.classList.remove('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
        voiceButton.classList.add('bg-amber-600', 'hover:bg-amber-700');
        voiceButton.disabled = false;
        
        if (statusText) statusText.textContent = 'Tap to record a voice note';
        if (recordingIndicator) recordingIndicator.classList.add('hidden');
        if (timerElement) {
          timerElement.classList.add('hidden');
          timerElement.textContent = '0:00';
        }
        break;
    }
  }

  cleanup() {
    this.stopStream();
    
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }
  }
}

// Initialize voice recorder when DOM is loaded
document.addEventListener('turbo:load', () => {
  const voiceRecorderForm = document.getElementById('voice-recorder-form');
  if (!voiceRecorderForm) return;

  const recorder = new VoiceRecorder();
  
  // Detect context: notebook, chat, or rich text editor
  const notebookTextArea = document.querySelector('#note_body');
  const chatTextArea = document.querySelector('#chat_message_body');
  const trixEditor = document.querySelector('trix-editor');
  const textArea = notebookTextArea || chatTextArea;
  
  if (!textArea && !trixEditor) {
    console.warn('No textarea or trix editor found for voice recorder');
    return;
  }

  // Helper function to insert text into Trix editor
  function insertIntoTrixEditor(text) {
    if (trixEditor) {
      const editor = trixEditor.editor;
      if (editor) {
        editor.insertString(text);
        trixEditor.focus();
      }
    }
  }

  // Helper function to insert text into regular textarea
  function insertIntoTextArea(text) {
    if (textArea) {
      const startPos = textArea.selectionStart;
      const endPos = textArea.selectionEnd;
      const currentContent = textArea.value;
      
      const newContent = currentContent.substring(0, startPos) + text + currentContent.substring(endPos);
      textArea.value = newContent;
      
      const newCursorPos = startPos + text.length;
      textArea.focus();
      textArea.setSelectionRange(newCursorPos, newCursorPos);
      
      if (textArea.scrollTop !== undefined) {
        textArea.scrollTop = textArea.scrollHeight;
      }
    }
  }

  // Override transcription callbacks
  recorder.onTranscriptionComplete = (transcription) => {
    if (trixEditor) {
      insertIntoTrixEditor(transcription);
    } else if (textArea) {
      insertIntoTextArea(transcription);
    }
    
    recorder.updateUI('ready');
    showNotification('Voice note transcribed successfully!', 'success');
  };

  recorder.onTranscriptionError = (error) => {
    recorder.updateUI('ready');
    showNotification(error, 'error');
  };

  // Voice recording button handler
  const voiceButton = document.getElementById('voice-record-btn');
  if (voiceButton) {
    const handleRecordingToggle = async (event) => {
      event.preventDefault();
      
      try {
        if (recorder.isRecording) {
          recorder.stopRecording();
        } else {
          await recorder.startRecording();
        }
      } catch (error) {
        console.error('Voice recording error:', error);
        showNotification(error.message || 'Error accessing microphone', 'error');
      }
    };
    
    voiceButton.addEventListener('click', handleRecordingToggle);
    voiceButton.addEventListener('touchend', handleRecordingToggle);
    
    voiceButton.addEventListener('touchstart', (event) => {
      event.preventDefault();
    });
  }

  // Voice toggle button handler
  const voiceToggleBtn = document.getElementById('voice-toggle-btn');
  if (voiceToggleBtn) {
    const handleToggle = (event) => {
      event.preventDefault();
      
      const isHidden = voiceRecorderForm.classList.contains('hidden');
      if (isHidden) {
        voiceRecorderForm.classList.remove('hidden');
        voiceToggleBtn.classList.add('bg-amber-600', 'hover:bg-amber-700');
        voiceToggleBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
      } else {
        voiceRecorderForm.classList.add('hidden');
        voiceToggleBtn.classList.remove('bg-amber-600', 'hover:bg-amber-700');
        voiceToggleBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        if (recorder.isRecording) {
          recorder.stopRecording();
        }
        recorder.stopStream();
      }
    };
    
    voiceToggleBtn.addEventListener('click', handleToggle);
    voiceToggleBtn.addEventListener('touchend', handleToggle);
    
    voiceToggleBtn.addEventListener('touchstart', (event) => {
      event.preventDefault();
    });
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    recorder.cleanup();
  });
});

// Utility function for notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-24 left-4 right-4 sm:top-24 sm:left-auto sm:right-4 sm:max-w-sm z-[60] p-3 sm:p-4 rounded-lg shadow-xl transition-all duration-300 transform translate-y-[-100px] opacity-0 ${
    type === 'success' ? 'bg-green-600 text-white border border-green-500/50' : 
    type === 'error' ? 'bg-red-600 text-white border border-red-500/50' : 
    'bg-blue-600 text-white border border-blue-500/50'
  }`;
  
  notification.innerHTML = `
    <div class="flex items-start space-x-2">
      <div class="flex-shrink-0 mt-0.5">
        ${type === 'success' ? 
          '<svg class="w-4 h-4 text-green-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' :
          type === 'error' ? 
          '<svg class="w-4 h-4 text-red-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>' :
          '<svg class="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>'
        }
      </div>
      <div class="flex-1 text-sm sm:text-base">${message}</div>
      <button class="flex-shrink-0 ml-2 text-white/80 hover:text-white transition-colors" onclick="this.closest('.fixed').remove()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 100);

  setTimeout(() => {
    notification.style.transform = 'translateY(-100px)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }, 5000);
}

export default VoiceRecorder;