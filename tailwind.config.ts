import type { Config } from 'tailwindcss';

/**
 * Bound to the tokens in src/styles/tokens.css. No literal colours here, and
 * none permitted in components — a value becomes a token first.
 *
 * Tailwind's stock palette is switched off entirely. Leaving it available is
 * how a codebase ends up with `bg-slate-900` and `text-indigo-500` sprinkled
 * through it, which is precisely the generated-template look this store must
 * not have.
 *
 * The class NAMES are deliberately stable across theme changes: `bg-bone` is
 * "the page ground" and `text-onyx` is "the strongest ink", whatever those
 * happen to resolve to. That is what let the whole storefront flip from light
 * to dark by editing one token file.
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

      // Ground
      bone: 'rgb(var(--bg) / <alpha-value>)',
      bone2: 'rgb(var(--bg-2) / <alpha-value>)',
      paper: 'rgb(var(--paper) / <alpha-value>)',
      paper2: 'rgb(var(--paper-2) / <alpha-value>)',

      // Ink
      onyx: 'rgb(var(--onyx) / <alpha-value>)',
      ink: 'rgb(var(--ink) / <alpha-value>)',
      greige: 'rgb(var(--greige) / <alpha-value>)',
      quiet: 'rgb(var(--quiet) / <alpha-value>)',

      // Line
      rule: 'rgb(var(--rule) / <alpha-value>)',
      ruleStrong: 'rgb(var(--rule-strong) / <alpha-value>)',

      // Metal
      gold: 'rgb(var(--gold) / <alpha-value>)',
      goldLight: 'rgb(var(--gold-light) / <alpha-value>)',
      goldDeep: 'rgb(var(--gold-deep) / <alpha-value>)',

      // Signal
      verdigris: 'rgb(var(--verdigris) / <alpha-value>)',
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
        expo: 'var(--ease-out-expo)',
      },
      transitionDuration: {
        1: 'var(--dur-1)',
        2: 'var(--dur-2)',
        3: 'var(--dur-3)',
        4: 'var(--dur-4)',
        5: 'var(--dur-5)',
      },
      aspectRatio: {
        product: '4 / 5',
        editorial: '3 / 2',
      },
    },
  },
  plugins: [],
};

export default config;
