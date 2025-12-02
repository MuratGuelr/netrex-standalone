// Keycode to human-readable label mapping for uiohook-napi
// Based on Linux keycodes used by uiohook-napi

const KEYCODE_MAP = {
  // Modifier Keys
  42: "Left Shift",
  54: "Right Shift",
  29: "Left Ctrl",
  3613: "Right Ctrl",
  97: "Right Ctrl", // Alternative keycode (some systems)
  56: "Left Alt",
  3640: "Right Alt", // AltGr
  3675: "Left Meta", // Left Windows/Command
  3676: "Right Meta", // Right Windows/Command
  125: "Left Meta", // Alternative keycode
  126: "Right Meta", // Alternative keycode

  // Letters
  30: "A",
  48: "B",
  46: "C",
  32: "D",
  18: "E",
  33: "F",
  34: "G",
  35: "H",
  23: "I",
  36: "J",
  37: "K",
  38: "L",
  50: "M",
  49: "N",
  24: "O",
  25: "P",
  16: "Q",
  19: "R",
  31: "S",
  20: "T",
  22: "U",
  47: "V",
  17: "W",
  45: "X",
  21: "Y",
  44: "Z",

  // Numbers (top row)
  2: "1",
  3: "2",
  4: "3",
  5: "4",
  6: "5",
  7: "6",
  8: "7",
  9: "8",
  10: "9",
  11: "0",

  // Function Keys
  59: "F1",
  60: "F2",
  61: "F3",
  62: "F4",
  63: "F5",
  64: "F6",
  65: "F7",
  66: "F8",
  67: "F9",
  68: "F10",
  87: "F11",
  88: "F12",
  91: "F13",
  92: "F14",
  93: "F15",
  99: "F16",
  100: "F17",
  101: "F18",
  102: "F19",
  103: "F20",
  104: "F21",
  105: "F22",
  106: "F23",
  107: "F24",

  // Special Keys
  57: "Space",
  1: "Esc",
  28: "Enter",
  15: "Tab",
  14: "Backspace",
  82: "Insert",
  83: "Delete",
  79: "Home",
  87: "End",
  73: "PageUp",
  81: "PageDown",
  72: "Up",
  80: "Down",
  75: "Left",
  77: "Right",
  69: "NumLock",
  70: "ScrollLock",
  58: "CapsLock",
  119: "Pause",
  3653: "Pause", // Windows Pause keycode
  3639: "PrintScreen",
  99: "PrintScreen", // Alternative keycode

  // Navigation Keys (extended)
  3655: "Home", // Extended Home keycode (some systems use 3655 for Pause, but Home is more common)
  3663: "End",
  3657: "PageUp",
  3665: "PageDown",
  57419: "Arrow Left",
  57416: "Arrow Up",
  57421: "Arrow Right",
  57424: "Arrow Down",
  3666: "Insert",
  3667: "Delete",
  
  // Windows-specific keycodes
  3654: "Break", // Break key (often same as Pause)
  3656: "Break", // Alternative Break keycode

  // Numpad
  82: "Numpad 0",
  79: "Numpad 1",
  80: "Numpad 2",
  81: "Numpad 3",
  75: "Numpad 4",
  76: "Numpad 5",
  77: "Numpad 6",
  71: "Numpad 7",
  72: "Numpad 8",
  73: "Numpad 9",
  55: "Numpad *",
  78: "Numpad +",
  74: "Numpad -",
  83: "Numpad .",
  3637: "Numpad /",

  // Punctuation and Symbols
  12: "-",
  13: "=",
  26: "[",
  27: "]",
  43: "\\",
  39: ";",
  40: "'",
  41: "`",
  51: ",",
  52: ".",
  53: "/",
};

/**
 * Get human-readable label for a keycode
 * @param {number} keycode - The keycode from uiohook-napi
 * @returns {string} Human-readable key name or "Unknown Key (keycode)" if not found
 */
export function getKeyLabel(keycode) {
  if (keycode === null || keycode === undefined) {
    return "Not Set";
  }

  // Handle duplicate keycodes (prioritize more specific mappings)
  // For keys that appear in multiple contexts, we check the most common usage first
  if (keycode === 87) {
    // Could be F11 or End - prioritize F11 as it's more common
    return KEYCODE_MAP[87] || "F11";
  }
  
  if (keycode === 3653) {
    // Windows Pause key - explicitly mapped
    return KEYCODE_MAP[3653] || "Pause";
  }
  
  if (keycode === 3655) {
    // Could be Home or Pause depending on system
    // Default to Home as it's more common, but check map first
    return KEYCODE_MAP[3655] || "Home";
  }

  // Try to find in map
  if (KEYCODE_MAP[keycode]) {
    return KEYCODE_MAP[keycode];
  }

  // For unknown keys, try to provide a better name based on common patterns
  // This is a fallback for keys we haven't mapped yet
  return `Unknown Key (${keycode})`;
}

/**
 * Check if a keycode is a modifier key
 * @param {number} keycode - The keycode to check
 * @returns {boolean} True if the keycode is a modifier key
 */
export function isModifierKey(keycode) {
  const modifierKeycodes = [
    42,
    54, // Shift
    29,
    3613,
    97, // Ctrl
    56,
    3640, // Alt
    3675,
    3676,
    125,
    126, // Meta/Windows
  ];
  return modifierKeycodes.includes(keycode);
}

/**
 * Get label for mouse button
 * @param {number} button - The button code
 * @returns {string}
 */
export function getMouseLabel(button) {
  switch (button) {
    case 3:
      return "Middle Click";
    case 4:
      return "Mouse 4 (Back)";
    case 5:
      return "Mouse 5 (Forward)";
    default:
      return `Mouse ${button}`;
  }
}
