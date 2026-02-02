class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 2048 sample buffer (approx 42ms at 48kHz)
    this._bufferSize = 2048;
    this._buffer = new Float32Array(this._bufferSize);
    this._bufferIndex = 0;
    
    // Report every 85ms (approx) - Balanced for CPU vs Responsiveness
    // 85ms / (128 samples / 48000 Hz) ≈ 32 quanta
    this._reportIntervalQuanta = 32;
    this._quantaCount = 0;
  }

  // Calculate RMS (Root Mean Square) for Float32 (-1.0 to 1.0)
  calculateRMS(data) {
    let sum = 0;
    const len = data.length;
    for (let i = 0; i < len; i++) {
        sum += data[i] * data[i];
    }
    return Math.sqrt(sum / len);
  }

  // Calculate ZCR (Zero Crossing Rate)
  calculateZCR(data) {
    let crossings = 0;
    const len = data.length;
    if (len < 2) return 0;
    
    for (let i = 1; i < len; i++) {
        if ((data[i-1] >= 0 && data[i] < 0) || (data[i-1] < 0 && data[i] >= 0)) {
            crossings++;
        }
    }
    return crossings / len;
  }

  process(inputs, outputs, parameters) {
    // Note: We only care about the first input, first channel (Mono analysis)
    const input = inputs[0];
    if (input && input.length > 0) {
        const channelData = input[0];
        
        // Fill the buffer with new data
        if (this._bufferIndex + channelData.length <= this._bufferSize) {
            this._buffer.set(channelData, this._bufferIndex);
            this._bufferIndex += channelData.length;
        } else {
            // If buffer creates overflow, just fill what we can and reset (simple snapshot)
            // Or ideally, handle ring buffer, but for VAD snapshots this is acceptable
            const spaceLeft = this._bufferSize - this._bufferIndex;
            this._buffer.set(channelData.subarray(0, spaceLeft), this._bufferIndex);
            this._bufferIndex = this._bufferSize;
        }
    }

    this._quantaCount++;

    // Check if it's time to report metrics (every ~80ms)
    if (this._quantaCount >= this._reportIntervalQuanta) {
        if (this._bufferIndex > 0) {
            // Process the accumulated buffer
            // Only convert the valid part of the buffer
            const validData = this._buffer.subarray(0, this._bufferIndex);
            
            const rms = this.calculateRMS(validData);
            const zcr = this.calculateZCR(validData);

            // Send metrics to main thread
            this.port.postMessage({
                type: 'metrics',
                rms: rms,
                zcr: zcr
            });

            // Reset buffer and counter
            this._bufferIndex = 0;
            this._quantaCount = 0;
        }
    }

    // Keep the processor alive
    return true;
  }
}

registerProcessor('voice-processor', VoiceProcessor);
