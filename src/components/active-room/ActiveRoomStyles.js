
export const styleInjection = `
  /* Minimal CPU Usage Animations */
  @keyframes pulse-opacity { 
    0%, 100% { opacity: 0.8; } 
    50% { opacity: 0.4; } 
  }
  
  @keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 var(--pulse-color); }
    70% { box-shadow: 0 0 0 6px rgba(0,0,0,0); }
    100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.4; }
  }

  .speaking-avatar { 
    transition: all 0.2s ease-out; 
    will-change: opacity;
  }
  
  .volume-slider { -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; }
  .volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; cursor: pointer; }
  
  /* Utilities */
  .will-change-opacity { will-change: opacity; }
  .will-change-transform { will-change: transform; }
`;
