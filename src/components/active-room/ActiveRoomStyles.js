
export const styleInjection = `
  @keyframes pulse-ring { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
  .speaking-avatar { animation: pulse-ring 2s infinite; }
  .volume-slider { -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; }
  .volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; cursor: pointer; }
  
  /* Control Bar Toggle Button Animation */
  @keyframes fadeScaleIn {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-fadeScaleIn {
    animation: fadeScaleIn 0.3s ease-out 0.15s both;
  }
  
  /* Bottom Controls Animations */
  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }
  @keyframes pulse-border {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.02);
    }
  }
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  @keyframes camera-active {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
    }
    50% {
      box-shadow: 0 0 20px 5px rgba(255, 255, 255, 0.2);
    }
  }
  @keyframes screen-share-active {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
    }
    50% {
      box-shadow: 0 0 20px 5px rgba(34, 197, 94, 0.3);
    }
  }
  @keyframes pulse-slow {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
  }
  .animate-ripple {
    animation: ripple 0.6s ease-out;
  }
  .animate-pulse-border {
    animation: pulse-border 2s ease-in-out infinite;
  }
  .animate-shimmer {
    animation: shimmer 3s linear infinite;
  }
  .animate-camera-active {
    animation: camera-active 2s ease-in-out infinite;
  }
  .animate-screen-share-active {
    animation: screen-share-active 2s ease-in-out infinite;
  }
  .animate-pulse-slow {
    animation: pulse-slow 4s ease-in-out infinite;
  }
  
  /* User Card Animations */
  @keyframes user-card-active {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.01);
    }
  }
  @keyframes pulse-border-video {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes avatar-pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
  @keyframes pulse-glow-slow {
    0%, 100% {
      opacity: 0.1;
      transform: scale(1);
    }
    50% {
      opacity: 0.2;
      transform: scale(1.02);
    }
  }
  .animate-user-card-active {
    animation: user-card-active 3s ease-in-out infinite;
  }
  .animate-pulse-border-video {
    animation: pulse-border-video 2s ease-in-out infinite;
  }
  .animate-avatar-pulse {
    animation: avatar-pulse 2s ease-in-out infinite;
  }
  .animate-pulse-glow-slow {
    animation: pulse-glow-slow 3s ease-in-out infinite;
  }
  
  /* Speaking Background Animations */
  @keyframes speaking-glow {
    0%, 100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
  }
  @keyframes speaking-pulse-ring {
    0% {
      opacity: 0.4;
      transform: scale(0.95);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
    100% {
      opacity: 0.4;
      transform: scale(0.95);
    }
  }
  @keyframes speaking-corner-glow {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    25% {
      opacity: 0.6;
      transform: scale(1.1);
    }
    50% {
      opacity: 0.4;
      transform: scale(1.05);
    }
    75% {
      opacity: 0.7;
      transform: scale(1.15);
    }
  }
  .animate-speaking-glow {
    animation: speaking-glow 2s ease-in-out infinite;
  }
  .animate-speaking-pulse-ring {
    animation: speaking-pulse-ring 3s ease-in-out infinite;
  }
  .animate-speaking-corner-glow {
    animation: speaking-corner-glow 4s ease-in-out infinite;
  }
`;
