const palette = {
  brand: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316',
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    1000: '#000000',
  },
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
  },
  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
  },
} as const;

export const colors = {
  // Brand
  primary: palette.brand[500],
  primaryLight: palette.brand[400],
  primaryDark: palette.brand[600],
  primarySoft: palette.brand[100],
  primarySurface: palette.brand[50],
  secondary: palette.brand[300],
  secondaryLight: palette.brand[200],

  // Status
  success: palette.success[500],
  successDark: palette.success[600],
  successLight: palette.success[100],
  successSurface: palette.success[50],
  danger: palette.danger[500],
  dangerDark: palette.danger[600],
  dangerLight: palette.danger[100],
  dangerSurface: palette.danger[50],
  warning: palette.warning[500],
  warningDark: palette.warning[600],
  warningLight: palette.warning[100],
  warningSurface: palette.warning[50],
  info: palette.info[500],
  infoLight: palette.info[100],
  infoSurface: palette.info[50],

  // Surfaces
  background: '#FAFAFA',
  surface: palette.neutral[0],
  surfaceMuted: '#F5F5F5',
  card: palette.neutral[0],

  // Text
  text: palette.neutral[900],
  textSecondary: palette.neutral[500],
  textLight: palette.neutral[400],
  textMuted: palette.neutral[400],
  textInverse: palette.neutral[0],

  // Borders & dividers
  border: '#EAEAEA',
  borderStrong: palette.neutral[300],
  divider: '#F0F0F0',

  // Inputs
  inputBg: palette.neutral[50],

  // Neutrals
  white: palette.neutral[0],
  black: palette.neutral[1000],

  // Full palette access for advanced usage
  palette,
} as const;

export const spacing = {
  '2xs': 2,
  xs: 4,
  '1.5': 6,
  sm: 8,
  '2.5': 10,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const fontSize = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  base: 16,
  md: 17,
  lg: 18,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
};

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: fontWeight.extrabold, letterSpacing: -0.6 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: fontWeight.extrabold, letterSpacing: -0.4 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: fontWeight.bold, letterSpacing: -0.1 },
  h4: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold },
  body: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.regular },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.medium },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.medium },
  subhead: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.medium },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.regular },
  captionStrong: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.semibold, letterSpacing: 0.4 },
  button: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.semibold, letterSpacing: 0 },
} as const;

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: palette.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: palette.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: palette.neutral[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  brand: {
    shadowColor: palette.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;

export const opacity = {
  disabled: 0.4,
  muted: 0.6,
  overlay: 0.5,
  pressed: 0.85,
} as const;

export const duration = {
  fast: 150,
  base: 200,
  slow: 350,
} as const;
