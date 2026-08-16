import type { Config } from 'tailwindcss';

/**
 * Tailwind is bound to the tokens in src/styles/tokens.css. There are no
 * literal colours here and none are permitted in components — if a value is
 * needed, it becomes a token first.
 *
 * The default palette is switched off entirely. Leaving Tailwind's stock
 * colours available is how a codebase ends up with `bg-slate-900` and
 * `text-indigo-500` scattered through it, which is exactly the generated-
 * template look this store has to avoid.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#ffffff',
      black: '#000000',

      bone: 'rgb(var(--bone) / <alpha-value>)',
      bone2: 'rgb(var(--bone-2) / <alpha-value>)',
      paper: 'rgb(var(--paper) / <alpha-value>)',

      onyx: 'rgb(var(--onyx) / <alpha-value>)',
      ink: 'rgb(var(--ink) / <alpha-value>)',
      greige: 'rgb(var(--greige) / <alpha-value>)',
      quiet: 'rgb(var(--quiet) / <alpha-value>)',

      rule: 'rgb(var(--rule) / <alpha-value>)',
      ruleStrong: 'rgb(var(--rule-strong) / <alpha-value>)',

      verdigris: 'rgb(var(--verdigris) / <alpha-value>)',
      verdigrisDeep: 'rgb(var(--verdigris-deep) / <alpha-value>)',
      brass: 'rgb(var(--brass) / <alpha-value>)',

      sale: 'rgb(var(--sale) / <alpha-value>)',
      positive: 'rgb(var(--positive) / <alpha-value>)',
      warn: 'rgb(var(--warn) / <alpha-value>)',
      danger: 'rgb(var(--danger) / <alpha-value>)',
    },
    borderRadius: {
      none: '0',
      sm: 'var(--radius-1)',
      DEFAULT: 'var(--radius-1)',
      md: 'var(--radius-2)',
      full: 'var(--radius-pill)',
    },
    boxShadow: {
      none: 'none',
      lift: 'var(--shadow-lift)',
    },
    extend: {
      fontFamily: {
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1.4' }],
        label: ['var(--step--1)', { lineHeight: '1.5' }],
        body: ['var(--step-0)', { lineHeight: '1.65' }],
        lede: ['var(--step-1)', { lineHeight: '1.6' }],
        d2: ['var(--step-2)', { lineHeight: '1.2' }],
        d3: ['var(--step-3)', { lineHeight: '1.12' }],
        d4: ['var(--step-4)', { lineHeight: '1.06' }],
        d5: ['var(--step-5)', { lineHeight: '1.02' }],
      },
      letterSpacing: {
        display: 'var(--tracking-display)',
        label: 'var(--tracking-label)',
      },
      maxWidth: {
        shell: 'var(--measure)',
        text: 'var(--measure-text)',
      },
      spacing: {
        section: 'var(--space-24)',
        band: 'var(--space-16)',
      },
      transitionTimingFunction: {
        ease: 'var(--ease)',
      },
      transitionDuration: {
        1: 'var(--dur-1)',
        2: 'var(--dur-2)',
        3: 'var(--dur-3)',
      },
      aspectRatio: {
        product: '4 / 5', // the portrait crop used across luxury retail
        editorial: '3 / 2',
      },
    },
  },
  plugins: [],
};

export default config;
