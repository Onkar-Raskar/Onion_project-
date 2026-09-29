import { colors } from './colors';

export const typography = {
  heroDisplay: { fontSize: 48, fontWeight: '900' as const, color: colors.textPrimary },
  heroStat: { fontSize: 32, fontWeight: '900' as const, color: colors.primary },
  h1: { fontSize: 22, fontWeight: '700' as const, lineHeight: 32, color: colors.textPrimary },
  h2: { fontSize: 18, fontWeight: '600' as const, lineHeight: 28, color: colors.textPrimary },
  bodyBold: { fontSize: 16, fontWeight: '700' as const, lineHeight: 24, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 24, color: colors.textPrimary },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 22, color: colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.5, color: colors.textSecondary },
  button: { fontSize: 16, fontWeight: 'bold' as const, letterSpacing: 0.5, color: '#FFF' },
};
