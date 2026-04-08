/**
 * Generates a smooth HSL color gradient for industrial risk levels.
 * 14 Days (336h) -> Green (120)
 * 7 Days (168h) -> Yellow (60)
 * 0 Days (0h) -> Red (0)
 */
export function getIndustrialColor(days: number) {
  // Clamp days between 0 and 14
  const clampedDays = Math.max(0, Math.min(14, days));
  
  // Map 0-14 days to 0-120 hue (Red to Green)
  const hue = (clampedDays / 14) * 120;
  
  return `hsl(${hue}, 80%, 50%)`;
}

export function getIndustrialGradient(days: number) {
  const color = getIndustrialColor(days);
  return {
    color: color,
    background: `${color}10`, // 10% opacity hex shorthand doesn't work for HSL, using CSS var or literal
    border: `${color}20`
  };
}

// Tailored for Tailwind-like utility usage
export function getUrgencyStyles(days: number) {
  const hue = (Math.max(0, Math.min(14, days)) / 14) * 120;
  return {
    color: `hsl(${hue}, 85%, 45%)`,
    backgroundColor: `hsl(${hue}, 85%, 45%, 0.1)`,
    borderColor: `hsl(${hue}, 85%, 45%, 0.2)`
  };
}
