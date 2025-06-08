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

      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      return true;
    } catch (error) {
      console.error('Error initializing voice recorder:', error);
      throw error;
    }
  }

  async startRecording() {
    if (this.isRecording) return;

    try {
      if (!this.stream) {
        await this.initialize();
      }

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop();
      };

      this.mediaRecorder.start();
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

    this.mediaRecorder.stop();
    this.isRecording = false;
    this.stopTimer();
    this.updateUI('processing');
  }

  handleRecordingStop() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
    this.transcribeAudio(audioBlob);
  }

  async transcribeAudio(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Get CSRF token
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

      const response = await fetch('/app/voice_notes/transcribe', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        body: formData
      });

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
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }
  }
}

// Initialize voice recorder when DOM is loaded
document.addEventListener('turbo:load', () => {
  // Check for both notebook and chat contexts
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
        // Insert text at current cursor position
        editor.insertString(text);
        
        // Focus the editor to maintain cursor position
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
      
      // Insert text at cursor position
      const newContent = currentContent.substring(0, startPos) + text + currentContent.substring(endPos);
      textArea.value = newContent;
      
      // Set cursor position after inserted text
      const newCursorPos = startPos + text.length;
      textArea.focus();
      textArea.setSelectionRange(newCursorPos, newCursorPos);
      
      // Scroll to cursor if needed
      if (textArea.scrollTop !== undefined) {
        textArea.scrollTop = textArea.scrollHeight;
      }
    }
  }

  // Override transcription callbacks
  recorder.onTranscriptionComplete = (transcription) => {
    // Insert into the appropriate editor
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

  // Voice toggle button handler (show/hide voice recorder)
  const voiceToggleBtn = document.getElementById('voice-toggle-btn');
  if (voiceToggleBtn) {
    voiceToggleBtn.addEventListener('click', () => {
      const isHidden = voiceRecorderForm.classList.contains('hidden');
      if (isHidden) {
        voiceRecorderForm.classList.remove('hidden');
        voiceToggleBtn.classList.add('bg-amber-600', 'hover:bg-amber-700');
        voiceToggleBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
      } else {
        voiceRecorderForm.classList.add('hidden');
        voiceToggleBtn.classList.remove('bg-amber-600', 'hover:bg-amber-700');
        voiceToggleBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        // Stop recording if it's active
        if (recorder.isRecording) {
          recorder.stopRecording();
        }
      }
    });
  }

  // Voice recording button handler
  const voiceButton = document.getElementById('voice-record-btn');
  if (voiceButton) {
    voiceButton.addEventListener('click', async () => {
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
    });
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    recorder.cleanup();
  });
});

// Utility function for notifications
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full ${
    type === 'success' ? 'bg-green-600 text-white' : 
    type === 'error' ? 'bg-red-600 text-white' : 
    'bg-blue-600 text-white'
  }`;
  
  notification.innerHTML = `
    <div class="flex items-center">
      <div class="flex-1">${message}</div>
      <button class="ml-2 text-white/80 hover:text-white" onclick="this.parentElement.parentElement.remove()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);

  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }, 5000);
}

export default VoiceRecorder; 