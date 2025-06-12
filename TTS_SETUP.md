# Google TTS Setup Guide

This application now uses Google Cloud Text-to-Speech for high-quality voice synthesis with prefetching and iOS compatibility.

## Setup Steps

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Cloud Text-to-Speech API**:
   - Navigate to APIs & Services > Library
   - Search for "Cloud Text-to-Speech API"
   - Click "Enable"

### 2. Create API Key

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key
4. (Optional) Restrict the API key to only Text-to-Speech API for security

### 3. Configure Rails Credentials

Add the API key to your Rails credentials:

```bash
# Open credentials file for editing
EDITOR="code --wait" rails credentials:edit

# Add this structure:
google:
  tts_api_key: your_api_key_here
```

### 4. Available Voices

The system supports these Google Cloud Neural2 voices:

**English (US)**
- `en-US-Neural2-A` (Female)
- `en-US-Neural2-B` (Male)
- `en-US-Neural2-C` (Female)
- `en-US-Neural2-D` (Male)
- `en-US-Neural2-E` (Female)
- `en-US-Neural2-F` (Male)

**English (UK)**
- `en-GB-Neural2-A` (Female)
- `en-GB-Neural2-B` (Male)

**French**
- `fr-FR-Neural2-A` (Female)
- `fr-FR-Neural2-B` (Male)

**Spanish**
- `es-ES-Neural2-A` (Female)
- `es-ES-Neural2-B` (Male)

## Features

### ✅ Implemented Features

- **Google TTS Integration**: High-quality Neural2 voices
- **Audio Prefetching**: Sentences are prefetched for smooth streaming
- **iOS Compatibility**: Works on all iOS devices and browsers
- **Voice Selection**: UI for selecting different voices and speeds
- **Queue Management**: Proper audio queue with duplicate prevention
- **Error Handling**: Robust error handling and retry logic
- **Memory Management**: Automatic cleanup of audio URLs

### ⚙️ Technical Features

- **Sentence-level Streaming**: Text is split into sentences for better streaming
- **Prefetch Queue**: Up to 5 items prefetched simultaneously
- **Duplicate Prevention**: Prevents duplicate audio for same content
- **Audio Context**: Proper iOS audio unlock with user gesture detection
- **Hands-free Chat**: Auto-starts voice recording when TTS completes

## Usage

### Basic Usage

1. Click the speaker icon next to any message to hear it read aloud
2. Use Ctrl+Shift+V to open the voice selector
3. Choose your preferred voice and speech speed
4. TTS will automatically stream as messages are received

### Voice Controls

- **Speaker Icon**: Start/stop TTS for individual messages
- **Voice Button**: Open voice selection modal
- **Speed Slider**: Adjust speech rate (0.5x to 2.0x)
- **Preview**: Test voices before selecting

### Keyboard Shortcuts

- `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac): Open voice selector

## API Usage

The Google TTS API supports these parameters:

```javascript
// POST /api/google_tts
{
  "text": "Hello world",
  "voice": "en-US-Neural2-A",
  "speed": 1.0
}
```

**Parameters:**
- `text`: Text to synthesize (max 5000 characters)
- `voice`: Voice name (default: en-US-Neural2-A)
- `speed`: Speech rate 0.25-4.0 (default: 1.0)

**Response:** MP3 audio file

## Pricing

Google Cloud TTS pricing (as of 2024):
- Neural2 voices: $0.000016 per character
- Example: 1000 characters = ~$0.016
- Includes 1 million free characters per month

## Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Check Rails credentials contain the API key
   - Restart the Rails server after adding credentials

2. **"Audio playback failed"**
   - Ensure user has interacted with the page (iOS requirement)
   - Check browser console for network errors

3. **No voice selector button**
   - Must be on a page with `#chat_messages` element
   - Button appears automatically on chat pages

4. **TTS not working on iOS**
   - First interaction must be user-initiated
   - Check that audio context is unlocked

### Debug Mode

Enable debug logging in browser console:
```javascript
// Show detailed TTS logs
localStorage.setItem('ttsDebug', 'true')
```

## API Limits

- **Rate Limits**: 1000 requests per minute
- **Text Length**: 5000 characters per request
- **Concurrent**: Up to 5 prefetch requests
- **Daily Quota**: Check your Google Cloud Console

## Security Notes

- API key is server-side only (not exposed to clients)
- Authentication required for all TTS requests
- Text length validation to prevent abuse
- Rate limiting handled by Google Cloud 