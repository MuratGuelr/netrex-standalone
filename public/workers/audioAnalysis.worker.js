/**
 * 🎤 Audio Analysis Web Worker
 * 
 * Ağır audio analiz işlemlerini ana thread'den ayırır.
 * CPU kullanımını azaltır ve UI'ın takılmasını önler.
 */

// RMS hesaplama
function calculateRMS(dataArray) {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const x = (dataArray[i] - 128) / 128.0;
    sum += x * x;
  }
  return Math.sqrt(sum / dataArray.length);
}

// Ses seviyesi analizi
function analyzeAudioLevel(dataArray, threshold) {
  const rms = calculateRMS(dataArray);
  const isActive = rms > threshold;
  return { rms, isActive };
}

// Zero-Crossing Rate hesaplama
function calculateZCR(dataArray) {
  let crossings = 0;
  for (let i = 1; i < dataArray.length; i++) {
    if ((dataArray[i] >= 128 && dataArray[i - 1] < 128) ||
        (dataArray[i] < 128 && dataArray[i - 1] >= 128)) {
      crossings++;
    }
  }
  return crossings / dataArray.length;
}

// Frekans bandı enerji hesaplama
function calculateBandEnergy(frequencyData, startBin, endBin) {
  let sum = 0;
  for (let i = startBin; i < endBin && i < frequencyData.length; i++) {
    sum += frequencyData[i];
  }
  return sum / (endBin - startBin);
}

// Ana message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'ANALYZE_RMS': {
      const { dataArray, threshold } = data;
      const result = analyzeAudioLevel(new Uint8Array(dataArray), threshold);
      self.postMessage({ type: 'RMS_RESULT', data: result });
      break;
    }
    
    case 'ANALYZE_ZCR': {
      const { dataArray } = data;
      const zcr = calculateZCR(new Uint8Array(dataArray));
      self.postMessage({ type: 'ZCR_RESULT', data: { zcr } });
      break;
    }
    
    case 'ANALYZE_BAND_ENERGY': {
      const { frequencyData, startBin, endBin } = data;
      const energy = calculateBandEnergy(new Uint8Array(frequencyData), startBin, endBin);
      self.postMessage({ type: 'BAND_ENERGY_RESULT', data: { energy } });
      break;
    }
    
    case 'FULL_ANALYSIS': {
      const { dataArray, frequencyData, threshold, voiceLowBin, voiceHighBin } = data;
      const uintData = new Uint8Array(dataArray);
      const uintFreq = new Uint8Array(frequencyData);
      
      const rmsResult = analyzeAudioLevel(uintData, threshold);
      const zcr = calculateZCR(uintData);
      const voiceEnergy = calculateBandEnergy(uintFreq, voiceLowBin, voiceHighBin);
      
      self.postMessage({
        type: 'FULL_ANALYSIS_RESULT',
        data: {
          ...rmsResult,
          zcr,
          voiceEnergy
        }
      });
      break;
    }
    
    default:
      console.warn('Unknown message type:', type);
  }
};

// Worker hazır mesajı
self.postMessage({ type: 'READY' });
