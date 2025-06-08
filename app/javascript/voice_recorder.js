class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.maxDuration = 120000; // 2 minutes max
    this.recordingTimer = null;
    this.recordingStartTime = null;
    this.deviceInfo = this.detectDevice();
  }

  // Enhanced device detection
  detectDevice() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // Detect iPad specifically (including iPad Pro running iPadOS 13+ that reports as Mac)
    const isIPad = /iPad/.test(userAgent) || 
                   (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Detect iPhone
    const isIPhone = /iPhone/.test(userAgent);
    
    // Detect iPod
    const isIPod = /iPod/.test(userAgent);
    
    // General iOS detection
    const isIOS = isIPad || isIPhone || isIPod;
    
    console.log('Device detection:', { isIPad, isIPhone, isIPod, isIOS, userAgent, platform });
    
    return {
      isIPad,
      isIPhone, 
      isIPod,
      isIOS,
      userAgent,
      platform
    };
  }

  async initialize() {
    try {
      // Check if browser supports audio recording
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording');
      }

      // iOS-specific checks
      if (this.deviceInfo.isIOS) {
        // Safari iOS requires user interaction before requesting permissions
        if (!this.stream) {
          console.log(`${this.deviceInfo.isIPad ? 'iPad' : 'iOS'} detected - requesting microphone permission`);
        }
      }

      // iPad-optimized audio constraints for better transcription quality
      let audioConstraints;
      
      if (this.deviceInfo.isIPad) {
        // iPad-specific settings optimized for Whisper API
        audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100, // More standard rate for iPad
          sampleSize: 16,
          channelCount: 1,
          // iPad-specific additional constraints
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googAutoGainControl: true
        };
      } else if (this.deviceInfo.isIPhone) {
        // iPhone-specific settings (keep existing behavior)
        audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 1
        };
      } else {
        // Desktop/other devices
        audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          sampleSize: 16,
          channelCount: 1
        };
      }

      console.log('Audio constraints for', this.deviceInfo.isIPad ? 'iPad' : this.deviceInfo.isIPhone ? 'iPhone' : 'other device', ':', audioConstraints);

      const constraints = { audio: audioConstraints };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return true;
    } catch (error) {
      console.error('Error initializing voice recorder:', error);
      
      // Provide device-specific error messages
      if (this.deviceInfo.isIOS && error.name === 'NotAllowedError') {
        const device = this.deviceInfo.isIPad ? 'iPad' : 'iPhone';
        throw new Error(`Microphone permission denied. Please enable microphone access in Safari settings on your ${device}.`);
      } else if (this.deviceInfo.isIOS && error.name === 'NotSupportedError') {
        throw new Error('Audio recording not supported. Please use Safari browser on iOS.');
      }
      
      throw error;
    }
  }

  async startRecording() {
    if (this.isRecording) return;

    try {
      // Always re-initialize the stream for each recording session
      // This ensures fresh microphone access after previous recording was stopped
      await this.initialize();

      this.audioChunks = [];
      
      // Device-specific MIME types for optimal transcription quality
      let mimeTypes;
      
      if (this.deviceInfo.isIPad) {
        // iPad-optimized MIME types for better Whisper compatibility
        mimeTypes = [
          'audio/wav',                    // WAV is most reliable for iPad transcription
          'audio/mp4',                    // Fallback for iPad Safari
          'audio/webm;codecs=opus',       // If Chrome is used on iPad
          'audio/webm',                   // General WebM
          'audio/mp3'                     // Last resort
        ];
      } else if (this.deviceInfo.isIPhone) {
        // iPhone-optimized MIME types (keep existing priority)
        mimeTypes = [
          'audio/mp4',                    // Preferred for iPhone Safari
          'audio/webm;codecs=opus',       // Chrome/Firefox
          'audio/webm',                   // General WebM
          'audio/wav',                    // Universal fallback
          'audio/mp3'                     // Another fallback
        ];
      } else {
        // Desktop browsers
        mimeTypes = [
          'audio/webm;codecs=opus',       // Best quality for desktop
          'audio/webm',                   // General WebM
          'audio/wav',                    // High quality
          'audio/mp4',                    // Compatibility
          'audio/mp3'                     // Fallback
        ];
      }
      
      let selectedMimeType = null;
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log(`Selected MIME type for ${this.deviceInfo.isIPad ? 'iPad' : this.deviceInfo.isIPhone ? 'iPhone' : 'desktop'}: ${mimeType}`);
          break;
        }
      }
      
      if (!selectedMimeType) {
        // Last resort - let the browser choose
        console.log('No supported MIME type found, using browser default');
        selectedMimeType = undefined;
      }
      
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      // Store the actual MIME type being used
      this.actualMimeType = this.mediaRecorder.mimeType || selectedMimeType || 'unknown';
      console.log(`MediaRecorder initialized with: ${this.actualMimeType}`);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`Audio chunk received: ${event.data.size} bytes`);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop();
      };

      // iPad may need different timeslice for better audio quality
      let timeslice;
      if (this.deviceInfo.isIPad) {
        timeslice = 500; // Shorter intervals for iPad to ensure better audio capture
      } else if (this.deviceInfo.isIPhone) {
        timeslice = 1000; // Keep existing iPhone behavior
      } else {
        timeslice = undefined; // Desktop default
      }
      
      console.log(`Using timeslice: ${timeslice}ms for ${this.deviceInfo.isIPad ? 'iPad' : this.deviceInfo.isIPhone ? 'iPhone' : 'desktop'}`);
      this.mediaRecorder.start(timeslice);
      
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
      
      // Stop the microphone stream immediately to remove browser recording indicator
      this.stopStream();
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.stopStream(); // Ensure stream is stopped even on error
      this.updateUI('ready');
    }
  }

  // New method to stop the microphone stream
  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped microphone track:', track.kind);
      });
      this.stream = null;
    }
  }

  handleRecordingStop() {
    // Use the actual MIME type from MediaRecorder, with fallbacks
    let mimeType = this.actualMimeType || 'audio/mp4'; // Default to mp4 for iOS
    
    // iOS Safari sometimes reports weird MIME types, normalize them
    if (this.deviceInfo.isIOS && (!mimeType || mimeType === 'unknown')) {
      mimeType = 'audio/mp4';
    }
    
    const audioBlob = new Blob(this.audioChunks, { type: mimeType });
    console.log(`Created blob: ${mimeType}, size: ${audioBlob.size} bytes, chunks: ${this.audioChunks.length}`);
    
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
      let fileName = 'recording.mp4'; // Default for iOS
      if (audioBlob.type.includes('webm')) {
        fileName = 'recording.webm';
      } else if (audioBlob.type.includes('wav')) {
        fileName = 'recording.wav';
      } else if (audioBlob.type.includes('mp3') || audioBlob.type.includes('mpeg')) {
        fileName = 'recording.mp3';
      } else if (audioBlob.type.includes('ogg')) {
        fileName = 'recording.ogg';
      }
      
      console.log(`Uploading as: ${fileName} (${audioBlob.type})`);
      formData.append('audio', audioBlob, fileName);
      
      // Send device information for server-side optimization
      formData.append('device_type', this.deviceInfo.isIPad ? 'ipad' : this.deviceInfo.isIPhone ? 'iphone' : 'other');
      formData.append('is_ios', this.deviceInfo.isIOS.toString());
      formData.append('user_agent', this.deviceInfo.userAgent);
      formData.append('mime_type', audioBlob.type);
      formData.append('file_size', audioBlob.size.toString());
      
      console.log(`Device info sent: ${this.deviceInfo.isIPad ? 'iPad' : this.deviceInfo.isIPhone ? 'iPhone' : 'other'} (iOS: ${this.deviceInfo.isIOS})`);

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
        console.log('Transcription successful:', result.transcription);
        this.onTranscriptionComplete(result.transcription);
      } else {
        console.error('Transcription failed:', result.error);
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

  // Voice recording button handler
  const voiceButton = document.getElementById('voice-record-btn');
  if (voiceButton) {
    // Add both click and touch event handlers for iOS compatibility
    const handleRecordingToggle = async (event) => {
      event.preventDefault(); // Prevent default touch behavior
      
      try {
        if (recorder.isRecording) {
          recorder.stopRecording();
        } else {
          await recorder.startRecording();
        }
      } catch (error) {
        console.error('Voice recording error:', error);
        let errorMessage = error.message || 'Error accessing microphone';
        
        // iOS-specific error handling
        if (recorder.deviceInfo.isIOS) {
          if (error.message.includes('permission')) {
            errorMessage = 'Please allow microphone access in Safari settings: Settings > Safari > Microphone';
          } else if (error.message.includes('not supported')) {
            errorMessage = 'Please use Safari browser for voice recording on iOS devices';
          }
        }
        
        showNotification(errorMessage, 'error');
      }
    };
    
    // Add multiple event listeners for better iOS compatibility
    voiceButton.addEventListener('click', handleRecordingToggle);
    voiceButton.addEventListener('touchend', handleRecordingToggle);
    
    // Prevent double-firing on iOS
    voiceButton.addEventListener('touchstart', (event) => {
      event.preventDefault();
    });
  }

  // Voice toggle button handler (show/hide voice recorder)
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
        // Stop recording if it's active and cleanup microphone
        if (recorder.isRecording) {
          recorder.stopRecording();
        }
        // Ensure microphone is fully released
        recorder.stopStream();
      }
    };
    
    // Add both click and touch events for iOS
    voiceToggleBtn.addEventListener('click', handleToggle);
    voiceToggleBtn.addEventListener('touchend', handleToggle);
    
    // Prevent double-firing on iOS
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
  // Create notification element
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

  // Animate in with both opacity and transform
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 100);

  // Auto remove after 5 seconds
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