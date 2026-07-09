/**
 * Sada App — Theme System
 * Central export for all design tokens
 */

export { colors, withAlpha, type ColorTokens } from './colors';
export {
  fontFamilies,
  displayFamilies,
  altFamilies,
  getFontFamily,
  getDisplayFamily,
  fontSizes,
  lineHeights,
  fontWeights,
  textStyles,
  type TextStyleName,
} from './typography';
export { spacing, radius, shadows, layout } from './spacing';

// Re-export as theme object for convenience
import { colors } from './colors';
import { fontSizes, fontWeights, textStyles } from './typography';
import { spacing, radius, shadows, layout } from './spacing';

export const theme = {
  colors,
  fontSizes,
  fontWeights,
  textStyles,
  spacing,
  radius,
  shadows,
  layout,
} as const;

export type Theme = typeof theme;
