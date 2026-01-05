/**
 * LED Fan Color Corrector
 * Corrects RGB values for accurate LED fan color display
 */

// ===== Device Profiles =====
// Each device has different LED characteristics and needs different corrections
const DEVICE_PROFILES = {
  'tl-fans': {
    name: 'Lian Li TL Fans',
    // Green reduction factor for warm colors (0-1)
    greenReduction: 0.85,
    // Hue shift in degrees (negative = shift toward red)
    hueShift: -8,
    // Saturation boost multiplier
    saturationBoost: 1.15,
    // Blue reduction for warm colors
    blueReduction: 0.7,
    // Special correction for problematic hue ranges
    hueCorrections: [
      { range: [15, 45], greenMultiplier: 0.08, hueShift: -10 },  // Orange
      { range: [45, 65], greenMultiplier: 0.15, hueShift: -5 },   // Yellow
      { range: [270, 300], blueMultiplier: 0.85, hueShift: 5 },   // Purple
      { range: [170, 200], greenMultiplier: 0.9, hueShift: 3 },   // Teal/Cyan
    ]
  },
  'strimer': {
    name: 'Lian Li Strimer',
    greenReduction: 0.80,
    hueShift: -10,
    saturationBoost: 1.2,
    blueReduction: 0.65,
    hueCorrections: [
      { range: [15, 45], greenMultiplier: 0.10, hueShift: -12 },  // Orange - more correction needed
      { range: [45, 65], greenMultiplier: 0.18, hueShift: -6 },   // Yellow
      { range: [270, 300], blueMultiplier: 0.82, hueShift: 6 },   // Purple
      { range: [170, 200], greenMultiplier: 0.88, hueShift: 4 },  // Teal/Cyan
    ]
  },
  'sl-fans': {
    name: 'Lian Li SL Fans',
    greenReduction: 0.88,
    hueShift: -6,
    saturationBoost: 1.1,
    blueReduction: 0.75,
    hueCorrections: [
      { range: [15, 45], greenMultiplier: 0.12, hueShift: -8 },   // Orange
      { range: [45, 65], greenMultiplier: 0.20, hueShift: -4 },   // Yellow
      { range: [270, 300], blueMultiplier: 0.88, hueShift: 4 },   // Purple
      { range: [170, 200], greenMultiplier: 0.92, hueShift: 2 },  // Teal/Cyan
    ]
  }
};

// Contextual tips based on color hue
const COLOR_TIPS = {
  orange: 'For orange colors, the green channel needs significant reduction. LEDs over-represent green, making orange appear yellow.',
  yellow: 'Yellow is tricky because it\'s created by mixing red and green. Reduce green substantially and boost red.',
  purple: 'Purple often appears too blue on LEDs. We reduce the blue channel and shift the hue slightly.',
  teal: 'Teal and cyan can appear too green. We balance the green and blue channels for accuracy.',
  red: 'Pure red usually displays accurately, but slight adjustments help maintain vibrancy.',
  green: 'Green LEDs are naturally bright. Consider if you want the full intensity.',
  blue: 'Blue typically displays well on LEDs with minimal correction needed.',
  pink: 'Pink requires careful balancing of red and blue to avoid appearing too magenta.',
  default: 'Use the corrected values in your L-Connect software to achieve the desired color.'
};

// ===== State =====
let currentDevice = 'tl-fans';
let currentColor = { r: 255, g: 102, b: 0 }; // Default orange

// ===== DOM Elements =====
const elements = {
  colorPicker: document.getElementById('colorPicker'),
  colorPickerOverlay: document.getElementById('colorPickerOverlay'),
  hexInput: document.getElementById('hexInput'),
  rInput: document.getElementById('rInput'),
  gInput: document.getElementById('gInput'),
  bInput: document.getElementById('bInput'),
  targetPreview: document.getElementById('targetPreview'),
  targetHex: document.getElementById('targetHex'),
  targetRgb: document.getElementById('targetRgb'),
  correctedPreview: document.getElementById('correctedPreview'),
  correctedHex: document.getElementById('correctedHex'),
  correctedRgb: document.getElementById('correctedRgb'),
  deviceButtons: document.querySelectorAll('.device-btn'),
  presetButtons: document.querySelectorAll('.preset-btn'),
  copyHex: document.getElementById('copyHex'),
  copyRgb: document.getElementById('copyRgb'),
  toast: document.getElementById('toast'),
  tipBox: document.getElementById('tipBox'),
  tipText: document.querySelector('.tip-text')
};

// ===== Color Utility Functions =====

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Convert RGB to HEX
 */
function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert HEX to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Validate HEX color
 */
function isValidHex(hex) {
  return /^#?([a-f\d]{6})$/i.test(hex);
}

// ===== Color Correction Algorithm =====

/**
 * Get the color category based on hue
 */
function getColorCategory(hue) {
  if (hue >= 0 && hue < 15) return 'red';
  if (hue >= 15 && hue < 45) return 'orange';
  if (hue >= 45 && hue < 70) return 'yellow';
  if (hue >= 70 && hue < 150) return 'green';
  if (hue >= 150 && hue < 200) return 'teal';
  if (hue >= 200 && hue < 260) return 'blue';
  if (hue >= 260 && hue < 310) return 'purple';
  if (hue >= 310 && hue < 340) return 'pink';
  return 'red'; // 340-360 is still red
}

/**
 * Apply device-specific color correction
 */
function correctColor(rgb, deviceProfile) {
  const profile = DEVICE_PROFILES[deviceProfile];
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  let correctedR = rgb.r;
  let correctedG = rgb.g;
  let correctedB = rgb.b;
  let correctedHue = hsl.h;
  let correctedSat = hsl.s;
  
  // Find if this hue falls into a special correction range
  let specialCorrection = null;
  for (const correction of profile.hueCorrections) {
    const [min, max] = correction.range;
    if (hsl.h >= min && hsl.h <= max) {
      specialCorrection = correction;
      break;
    }
  }
  
  // Apply corrections based on color type
  if (specialCorrection) {
    // Apply special corrections for problematic colors
    if (specialCorrection.greenMultiplier !== undefined) {
      // For orange/yellow: drastically reduce green
      correctedG = Math.round(rgb.g * specialCorrection.greenMultiplier);
    }
    if (specialCorrection.blueMultiplier !== undefined) {
      correctedB = Math.round(rgb.b * specialCorrection.blueMultiplier);
    }
    correctedHue = Math.max(0, Math.min(360, hsl.h + specialCorrection.hueShift));
  } else {
    // For warm colors (red to yellow-green), apply green reduction
    if (hsl.h >= 0 && hsl.h <= 90) {
      // Calculate green reduction based on how "warm" the color is
      const warmFactor = 1 - (hsl.h / 90);
      const greenReductionAmount = warmFactor * (1 - profile.greenReduction);
      correctedG = Math.round(rgb.g * (1 - greenReductionAmount));
      correctedHue = Math.max(0, hsl.h + (profile.hueShift * warmFactor));
    }
    
    // For cool colors with blue, apply blue reduction if needed
    if (hsl.h >= 200 && hsl.h <= 340) {
      const coolFactor = 1 - Math.abs((hsl.h - 270) / 70);
      const blueReductionAmount = coolFactor * (1 - profile.blueReduction);
      correctedB = Math.round(rgb.b * (1 - blueReductionAmount * 0.3));
    }
  }
  
  // Boost saturation for richer colors
  correctedSat = Math.min(100, hsl.s * profile.saturationBoost);
  
  // If we modified the hue or saturation significantly, recalculate RGB from HSL
  if (Math.abs(correctedHue - hsl.h) > 2 || Math.abs(correctedSat - hsl.s) > 5) {
    const newRgb = hslToRgb(correctedHue, correctedSat, hsl.l);
    // Blend the HSL-based correction with direct RGB correction
    correctedR = Math.round((correctedR + newRgb.r) / 2);
    correctedG = Math.round((correctedG + newRgb.g) / 2);
    correctedB = Math.round((correctedB + newRgb.b) / 2);
  }
  
  // Ensure values are in valid range
  return {
    r: Math.max(0, Math.min(255, correctedR)),
    g: Math.max(0, Math.min(255, correctedG)),
    b: Math.max(0, Math.min(255, correctedB))
  };
}

// ===== UI Update Functions =====

/**
 * Update all UI elements with current color
 */
function updateUI() {
  const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
  const hsl = rgbToHsl(currentColor.r, currentColor.g, currentColor.b);
  
  // Update input elements
  elements.colorPicker.value = hex;
  elements.colorPickerOverlay.style.backgroundColor = hex;
  elements.hexInput.value = hex;
  elements.rInput.value = currentColor.r;
  elements.gInput.value = currentColor.g;
  elements.bInput.value = currentColor.b;
  
  // Update target preview
  elements.targetPreview.style.backgroundColor = hex;
  elements.targetHex.textContent = hex;
  elements.targetRgb.textContent = `${currentColor.r}, ${currentColor.g}, ${currentColor.b}`;
  
  // Calculate and display corrected color
  const corrected = correctColor(currentColor, currentDevice);
  const correctedHex = rgbToHex(corrected.r, corrected.g, corrected.b);
  
  elements.correctedPreview.style.backgroundColor = correctedHex;
  elements.correctedHex.textContent = correctedHex;
  elements.correctedRgb.textContent = `${corrected.r}, ${corrected.g}, ${corrected.b}`;
  
  // Update tip based on color
  const category = getColorCategory(hsl.h);
  elements.tipText.textContent = COLOR_TIPS[category] || COLOR_TIPS.default;
}

/**
 * Show toast notification
 */
function showToast(message = 'Copied to clipboard!') {
  elements.toast.querySelector('.toast-text').textContent = message;
  elements.toast.classList.add('show');
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2000);
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast();
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast();
  }
}

// ===== Event Handlers =====

// Color picker change
elements.colorPicker.addEventListener('input', (e) => {
  const rgb = hexToRgb(e.target.value);
  if (rgb) {
    currentColor = rgb;
    updateUI();
  }
});

// HEX input change
elements.hexInput.addEventListener('input', (e) => {
  let value = e.target.value;
  if (!value.startsWith('#')) {
    value = '#' + value;
  }
  
  if (isValidHex(value)) {
    const rgb = hexToRgb(value);
    if (rgb) {
      currentColor = rgb;
      updateUI();
    }
  }
});

elements.hexInput.addEventListener('blur', (e) => {
  // Normalize the HEX value on blur
  const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
  e.target.value = hex;
});

// RGB inputs change
['rInput', 'gInput', 'bInput'].forEach((id) => {
  elements[id].addEventListener('input', (e) => {
    const value = parseInt(e.target.value) || 0;
    const channel = id.charAt(0); // r, g, or b
    currentColor[channel] = Math.max(0, Math.min(255, value));
    updateUI();
  });
});

// Device selection
elements.deviceButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    elements.deviceButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDevice = btn.dataset.device;
    updateUI();
  });
});

// Preset buttons
elements.presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const rgb = hexToRgb(btn.dataset.color);
    if (rgb) {
      currentColor = rgb;
      updateUI();
    }
  });
});

// Copy buttons
elements.copyHex.addEventListener('click', () => {
  copyToClipboard(elements.correctedHex.textContent);
});

elements.copyRgb.addEventListener('click', () => {
  copyToClipboard(elements.correctedRgb.textContent);
});

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  updateUI();
});

// Initial update
updateUI();
