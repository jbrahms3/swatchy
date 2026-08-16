/** Dark, neutral chrome — keeps the sampled colors the loudest thing on screen. */
export const T = {
  bg: '#0B0B0F',
  surface: '#15151C',
  surfaceHi: '#1E1E27',
  border: '#2A2A35',
  text: '#F4F4F7',
  textDim: '#9B9BAA',
  textFaint: '#6A6A7A',
  danger: '#FF5A5F',
} as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const space = (n: number) => n * 4;

/** Bottom padding lists need so the floating "Claim a color" button never covers content. */
export const FAB_CLEARANCE = 96;
