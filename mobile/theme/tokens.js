// Travalastic Semantic Design System Tokens (Dark Theme)

export const colors = {
  // Semantic Tokens
  background: '#131B2E',      // main screen background, everywhere
  surface: '#F7F3EA',         // elevated card surface (ticket-stub cards)
  surfaceAlt: '#1C2740',      // secondary card surface — lighter navy tint for dark-mode cards
  textPrimary: '#F7F3EA',     // text on dark background
  textOnSurface: '#131B2E',   // text inside a paper-surface card
  textMuted: 'rgba(247,243,234,0.6)',
  accentPrimary: '#E8A33D',   // marigold
  accentSecondary: '#2F6E68', // sea teal
  accentUrgent: '#D65A4A',    // runway coral
  border: 'rgba(247,243,234,0.15)',

  // Legacy / Direct Brand Aliases (backward-compatibility)
  inkNavy: '#131B2E',
  ticketPaper: '#F7F3EA',
  marigold: '#E8A33D',
  seaTeal: '#2F6E68',
  runwayCoral: '#D65A4A',
  inkNavyMuted: 'rgba(19,27,46,0.6)',
};

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_500Medium_Italic',
  body: 'Manrope_400Regular',
  bodyBold: 'Manrope_700Bold',
  mono: 'SpaceMono_400Regular',
};

// 8px-based scale: 4, 8, 12, 16, 24, 32, 48
const spacingScale = [4, 8, 12, 16, 24, 32, 48];
spacingScale.xxs = 4;
spacingScale.xs = 4;
spacingScale.sm = 8;
spacingScale.md = 12;
spacingScale.lg = 16;
spacingScale.xl = 24;
spacingScale.xxl = 32;
spacingScale.xxxl = 48;
spacingScale[4] = 4;
spacingScale[8] = 8;
spacingScale[12] = 12;
spacingScale[16] = 16;
spacingScale[24] = 24;
spacingScale[32] = 32;
spacingScale[48] = 48;

export const spacing = spacingScale;

export const radii = {
  card: 20,
  chip: 100,
  ticketNotch: 12,
};

export const theme = {
  colors,
  fonts,
  spacing,
  radii,
};

export default theme;
