class VoiceRecorder {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.maxDuration = 120000; // 2 minutes max
    this.recordingTimer = null;
    this.recordingStartTime = null;
    this.silenceTimer = null;
    this.silenceDelay = 2000; // Stop after 2 seconds of silence
    this.finalTranscript = '';
  }

  async initialize() {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Your browser does not support speech recognition. Please use Chrome, Safari, or Edge.');
      }

      this.recognition = new SpeechRecognition();
      
      // Configure speech recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = navigator.language || 'en-US';
      this.recognition.maxAlternatives = 1;
      
      // Set up event handlers
      this.setupSpeechRecognitionEvents();
      
      return true;
    } catch (error) {
      console.error('Error initializing voice recorder:', error);
      throw error;
    }
  }

  setupSpeechRecognitionEvents() {
    this.recognition.onstart = () => {
      console.log('Speech recognition started');
      this.isRecording = true;
      this.updateUI('recording');
    };

    this.recognition.onresult = (event) => {
      // Simple approach: just take the complete transcript from the last result
      let transcript = '';
      
      // Get all results and combine them properly
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        
        // Add space only after final results, not interim ones
        if (event.results[i].isFinal && i < event.results.length - 1) {
          transcript += ' ';
        }
      }

      // Show the transcript as live preview
      if (transcript.trim()) {
        this.showLivePreview(transcript.trim());
        this.resetSilenceTimer();
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      let errorMessage = 'Speech recognition failed. ';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech was detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Audio capture failed. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please enable microphone permissions.';
          break;
        case 'network':
          errorMessage = 'Network error occurred during speech recognition.';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not allowed.';
          break;
        default:
          errorMessage += event.error;
      }
      
      this.onTranscriptionError(errorMessage);
    };

    this.recognition.onend = () => {
      console.log('Speech recognition ended');
      this.isRecording = false;
      this.stopTimer();
      this.clearSilenceTimer();
      
      // Get the final text from the input field where it's already displayed
      const { notebookTextArea, chatTextArea, trixEditor } = getCurrentTextTargets();
      let finalText = '';
      
      if (trixEditor) {
        finalText = trixEditor.editor ? trixEditor.editor.getDocument().toString().trim() : '';
      } else {
        const textArea = notebookTextArea || chatTextArea;
        finalText = textArea ? textArea.value.trim() : '';
      }
      
      if (finalText) {
        this.finalTranscript = finalText;
        this.onTranscriptionComplete(finalText);
      }
      
      this.updateUI('ready');
    };

    // Handle speech start/end detection
    this.recognition.onspeechstart = () => {
      console.log('Speech detected');
      this.clearSilenceTimer();
    };

    this.recognition.onspeechend = () => {
      console.log('Speech ended');
      this.setSilenceTimer();
    };
  }

  async startRecording() {
    if (this.isRecording) return;

    try {
      await this.initialize();

      // Reset transcripts
      this.finalTranscript = '';
      
      // Clear any existing text in the input to prepare for new voice input
      this.clearInputField();
      
      this.recordingStartTime = Date.now();
      this.startTimer();

      // Start speech recognition
      this.recognition.start();

      // Auto-stop after max duration
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, this.maxDuration);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      this.onTranscriptionError(error.message);
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.recognition) return;

    try {
      this.recognition.stop();
      this.clearSilenceTimer();
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.isRecording = false;
      this.updateUI('ready');
    }
  }

  resetSilenceTimer() {
    this.clearSilenceTimer();
    this.setSilenceTimer();
  }

  setSilenceTimer() {
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording) {
        console.log('Stopping due to silence');
        this.stopRecording();
      }
    }, this.silenceDelay);
  }

  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  clearInputField() {
    const { notebookTextArea, chatTextArea, trixEditor } = getCurrentTextTargets();
    
    if (trixEditor) {
      const editor = trixEditor.editor;
      if (editor) {
        editor.loadHTML(''); // Clear trix editor
      }
    } else {
      const textArea = notebookTextArea || chatTextArea;
      if (textArea) {
        textArea.value = ''; // Clear textarea
      }
    }
  }

  showLivePreview(text) {
    // Temporarily replace input content with live preview (don't append)
    const { notebookTextArea, chatTextArea, trixEditor } = getCurrentTextTargets();
    
    if (trixEditor) {
      const editor = trixEditor.editor;
      if (editor) {
        // Replace entire content temporarily
        editor.loadHTML(text);
        trixEditor.focus();
      }
    } else {
      const textArea = notebookTextArea || chatTextArea;
      if (textArea) {
        // Replace entire content temporarily
        textArea.value = text;
        textArea.focus();
        // Move cursor to end
        textArea.setSelectionRange(text.length, text.length);
      }
    }
  }

  onTranscriptionComplete(transcription) {
    // The final transcription is already showing from live preview
    // Just need to trigger auto-submit for chat
    this.autoSubmitIfChat();
    
    this.updateUI('ready');
    showNotification('Voice message ready!', 'success');
  }

  onTranscriptionError(error) {
    this.updateUI('ready');
    showNotification(error, 'error');
  }

  autoSubmitIfChat() {
    // Auto-submit chat messages for hands-free interaction
    const chatForm = document.querySelector('#chat_form');
    const chatTextArea = document.querySelector('#chat_message_body');
    const submitButton = chatForm?.querySelector('button[type="submit"], input[type="submit"]');
    
    if (chatForm && chatTextArea && submitButton && chatTextArea.value.trim()) {
      // Small delay to ensure text is fully inserted
      setTimeout(() => {
        submitButton.click();
        showNotification('Message sent!', 'success');
      }, 500);
    }
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
    const voiceToggleBtn = document.getElementById('voice-toggle-btn');
    const statusText = document.getElementById('voice-status');
    const recordingIndicator = document.getElementById('recording-indicator');
    const timerElement = document.getElementById('recording-timer');

    // Update main voice button if it exists
    if (voiceButton) {
      switch (state) {
        case 'recording':
          voiceButton.querySelector('.record-icon').classList.add('hidden');
          voiceButton.querySelector('.stop-icon').classList.remove('hidden');
          voiceButton.classList.add('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
          voiceButton.classList.remove('bg-amber-600', 'hover:bg-amber-700');
          
          if (statusText) statusText.textContent = 'Listening... Speak now';
          if (recordingIndicator) recordingIndicator.classList.remove('hidden');
          if (timerElement) timerElement.classList.remove('hidden');
          break;

        case 'processing':
          voiceButton.querySelector('.record-icon').classList.remove('hidden');
          voiceButton.querySelector('.stop-icon').classList.add('hidden');
          voiceButton.classList.remove('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
          voiceButton.classList.add('bg-amber-600', 'hover:bg-amber-700');
          voiceButton.disabled = true;
          
          if (statusText) statusText.textContent = 'Processing speech...';
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
          
          if (statusText) statusText.textContent = 'Tap to speak';
          if (recordingIndicator) recordingIndicator.classList.add('hidden');
          if (timerElement) {
            timerElement.classList.add('hidden');
            timerElement.textContent = '0:00';
          }
          break;
      }
    }

    // Update voice toggle button if it exists
    if (voiceToggleBtn) {
      switch (state) {
        case 'recording':
          // Only allow recording state change if not disabled by streaming
          if (!voiceToggleBtn.disabled) {
            voiceToggleBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
            voiceToggleBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700', 'bg-amber-600', 'hover:bg-amber-700');
          }
          break;

        case 'processing':
          // Don't override disabled state from streaming
          if (!voiceToggleBtn.disabled) {
            voiceToggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
            voiceToggleBtn.classList.add('bg-amber-600', 'hover:bg-amber-700');
            voiceToggleBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            voiceToggleBtn.disabled = true;
          }
          break;

        case 'ready':
        default:
          // Only reset to ready state if not disabled by streaming
          if (!voiceToggleBtn.hasAttribute('disabled') || voiceToggleBtn.getAttribute('disabled') === 'false') {
            voiceToggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'animate-pulse', 'bg-amber-600', 'hover:bg-amber-700');
            voiceToggleBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            voiceToggleBtn.disabled = false;
          }
          break;
      }
    }
  }

  cleanup() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    
    this.clearSilenceTimer();
    
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }
  }
}

// Helper functions moved outside so they fetch fresh elements each time
function getCurrentTextTargets() {
  return {
    notebookTextArea: document.querySelector('#note_body'),
    chatTextArea:     document.querySelector('#chat_message_body'),
    trixEditor:       document.querySelector('trix-editor')
  };
}

function insertTranscriptionText(text) {
  const { notebookTextArea, chatTextArea, trixEditor } = getCurrentTextTargets();
  const textArea = notebookTextArea || chatTextArea;

  if (trixEditor) {
    const editor = trixEditor.editor;
    if (editor) {
      editor.insertString(text);
      trixEditor.focus();
      return true;
    }
  }

  if (textArea) {
    const startPos = textArea.selectionStart || textArea.value.length;
    const endPos   = textArea.selectionEnd   || textArea.value.length;
    const content  = textArea.value;

    textArea.value = content.slice(0, startPos) + text + content.slice(endPos);
    const cursorPos = startPos + text.length;
    textArea.focus();
    textArea.setSelectionRange(cursorPos, cursorPos);
    if (textArea.scrollTop !== undefined) textArea.scrollTop = textArea.scrollHeight;
    return true;
  }
  return false;
}

function initVoiceRecorder() {
  const voiceRecorderForm = document.getElementById('voice-recorder-form');
  if (!voiceRecorderForm) return;

  const recorder = new VoiceRecorder();
  window.voiceRecorderInstance = recorder;
  
  // Detect context: notebook, chat, or rich text editor
  const notebookTextArea = document.querySelector('#note_body');
  const chatTextArea = document.querySelector('#chat_message_body');
  const trixEditor = document.querySelector('trix-editor');
  const textArea = notebookTextArea || chatTextArea;
  
  if (!textArea && !trixEditor) {
    console.warn('No textarea or trix editor found for voice recorder');
    return;
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    recorder.cleanup();
  });
}

// Initialize on first load and on every subsequent Turbo render
document.addEventListener('turbo:load', initVoiceRecorder);
document.addEventListener('turbo:render', initVoiceRecorder);
document.addEventListener('turbo:frame-render', initVoiceRecorder);

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

// Global delegation (attach once)
if (!window.__voiceToggleDelegated) {
  const toggleHandler = async (event) => {
    const btn = event.target.closest('#voice-toggle-btn');
    if (!btn) return;
    event.preventDefault();

    // Check if button is disabled (when AI is streaming)
    if (btn.disabled) {
      showNotification('Please wait for AI response to complete', 'info');
      return;
    }

    const recorder = window.voiceRecorderInstance;
    if (!recorder) {
      showNotification('Voice recorder not available', 'error');
      return;
    }

    try {
      if (recorder.isRecording) {
        // Stop recording
        recorder.stopRecording();
        showNotification('Recording stopped', 'info');
      } else {
        // Start recording directly
        await recorder.startRecording();
        showNotification('🎤 Listening... Speak now', 'info');
      }
    } catch (error) {
      console.error('Voice recording error:', error);
      showNotification(error.message || 'Error accessing microphone', 'error');
      // Reset button state on error
      recorder.updateUI('ready');
    }
  };

  document.addEventListener('click', toggleHandler, { passive: false });
  document.addEventListener('touchend', toggleHandler, { passive: false });
  window.__voiceToggleDelegated = true;
}

// Global delegation for recording button
if (!window.__voiceRecordDelegated) {
  const recordHandler = async (event) => {
    const btn = event.target.closest('#voice-record-btn');
    if (!btn) return;
    event.preventDefault();

    const recorder = window.voiceRecorderInstance;
    if (!recorder) return;

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

  document.addEventListener('click', recordHandler, { passive: false });
  document.addEventListener('touchend', recordHandler, { passive: false });
  window.__voiceRecordDelegated = true;
}

export default VoiceRecorder;