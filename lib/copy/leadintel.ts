export const COPY = {
  brand: {
    name: 'LeadIntel',
  },
  positioning: {
    icpLine: 'Signal-based outbound platform for teams who need why-now intelligence and send-ready drafts.',
  },
  home: {
    hero: {
      headline: 'Find & Close Your Next Customers in 60 Seconds',
      subhead:
        'LeadIntel turns fresh buying signals into a prioritized list of high-fit accounts, with clear why-now context and AI outreach you can copy and send in minutes.',
      support: 'Leads refresh daily. Start with a limited preview, then unlock the full tracking and campaign workflow.',
      primaryCta: 'Find My Leads Now',
      secondaryCta: 'See pricing',
      microTrust: 'No signup required. Limited preview available.',
    },
    whatYouGet: {
      title: 'What you get',
      bullets: [
        'Daily shortlist: a short, prioritized list of accounts to action today',
        'Lead score (0–100) with clear reasons',
        'Outreach drafts: email + LinkedIn draft copy (review-first)',
        'Trigger signals: funding, hiring spikes, launches, partnerships, press mentions',
      ],
    },
    trySample: {
      sectionTitle: 'Generate a sample Daily Deal Digest',
      helper:
        'Enter a company name or website. We’ll generate a sample score, signals, and a send-ready outreach draft.',
      companyLabel: 'Company name or website',
      emailLabel: 'Email (optional)',
      checkboxLabel: 'Email me this sample',
      button: 'Generate sample',
      resultsTitle: (company: string) => `Sample digest for ${company}`,
      upsellLine: 'Want this daily for your target list? Unlock digests, saved reports, and templates.',
      upsellCta: 'Create your account',
    },
  },
  pricing: {
    hero: {
      headline: 'Choose the plan that drives faster pipeline outcomes.',
      subhead: 'Move from lead discovery to outreach execution and campaign tracking without losing speed.',
      bullets: [
        'Prioritize the right leads every day with explainable fit scoring',
        'Launch AI-assisted outreach without starting from a blank page',
        'Track campaign execution and keep your team aligned on what converts',
      ],
      trustStrip: (supportEmail: string) => `Transparent pricing. Cancel anytime. Support: ${supportEmail}.`,
      primaryCta: 'Start free',
      secondaryCta: 'Compare plans',
    },
    plans: {
      starterDescription: 'Validate lead quality fast with a limited preview before committing.',
      closerDescription: 'Convert faster with daily lead prioritization, AI outreach drafts, and a repeatable execution loop.',
      replacementClaim: 'Built to improve speed-to-meeting: find → prioritize → message → track.',
    },
  },
  onboarding: {
    screen1: {
      title: 'Set up your outbound signal engine',
      subhead: 'For outbound B2B SDRs/AEs who want trigger-based account alerts and instant pitch drafts.',
      primary: 'Start setup',
      secondary: 'Skip for now',
    },
    screen2: {
      title: 'Define what “good accounts” look like',
      helper: 'Your ICP helps LeadIntel prioritize alerts and draft outreach in your voice.',
      fields: {
        industry: 'Your target vertical(s)',
        buyerTitles: 'Who you sell to (e.g., VP Sales, RevOps)',
        companySize: 'Employees or ARR band',
        regions: 'Where you sell',
        notes: 'Any must-haves or disqualifiers',
      },
      primary: 'Save ICP',
      buyerTitlesMissing: 'Buyer titles are required to generate targeted outreach.',
    },
    screen3: {
      title: 'Add 10 target accounts to start the digest',
      helper: 'Paste company names or domains—one per line. You can edit later.',
      fieldLabel: 'Target accounts',
      primary: 'Add accounts',
      emptyHelper: 'Add at least 1 account to generate alerts and outreach drafts.',
      tooMany: (limit: number) => `That’s a lot at once. Add up to ${limit} accounts per import.`,
    },
    screen4: {
      title: 'Choose when you want alerts',
      helper: 'Daily digests keep your priorities clear. You can change this anytime.',
      options: {
        daily: 'Daily (recommended)',
        weekly: 'Weekly',
        off: 'Off (I’ll check manually)',
      },
      primary: 'Continue',
    },
    screen5: {
      title: 'Generate your first pitch draft',
      helper: 'Pick one account. We’ll generate a short “why now” and a send-ready draft.',
      primary: 'Generate pitch',
      secondary: 'I’ll do this later',
    },
    screen6: {
      title: 'You’re set.',
      subhead: 'Your digest will prioritize accounts with trigger signals and draft outreach you can send fast.',
      primary: 'Go to dashboard',
      secondary: 'View pricing',
    },
  },
  states: {
    empty: {
      noIcp: {
        title: 'No ICP yet.',
        body: 'Define your target buyer to prioritize alerts and generate targeted outreach.',
        primary: 'Set ICP',
        secondary: 'Learn how scoring works',
      },
      noAccounts: {
        title: 'No target accounts.',
        body: 'Add a list to start scoring, signals, and daily priorities.',
        primary: 'Add accounts',
        secondary: 'Generate a sample digest',
      },
      noDigest: {
        title: 'No digest scheduled.',
        body: 'Turn on alerts to get a prioritized shortlist with “why now” context.',
        primary: 'Set cadence',
        secondary: 'View use cases',
      },
      noSignals: {
        title: 'No trigger signals detected.',
        body: 'We’ll keep monitoring. In the meantime, use ICP fit and a clean opener to start the conversation.',
        primary: 'Generate pitch draft',
        secondary: 'Add more accounts',
      },
      noSavedOutputs: {
        title: 'No saved outputs.',
        body: 'Generate a pitch or report and it will appear here for quick reuse.',
        primary: 'Generate pitch',
        secondary: 'Go to dashboard',
      },
      noResults: {
        title: 'No results.',
        body: 'Try fewer filters or search by domain.',
        primary: 'Clear filters',
        secondary: 'Add account',
      },
    },
  },
  validation: {
    required: 'This field is required.',
    invalidEmail: 'Enter a valid email address.',
    invalidCompanyOrUrl: 'Enter a valid company name or website.',
  },
  rateLimit: {
    title: 'Slow down.',
    body: 'Too many requests. Try again in a few minutes.',
    cta: 'Retry',
  },
  errors: {
    requestFailed: {
      title: 'Something didn’t load.',
      body: 'Check your connection and try again.',
      primary: 'Retry',
      secondary: 'Back to dashboard',
    },
    sessionExpired: {
      title: 'Session expired.',
      body: 'Sign in again to continue.',
      primary: 'Sign in',
      secondary: 'Go home',
    },
    forbidden: {
      title: 'Access restricted.',
      body: 'You don’t have permission to view this.',
      primary: 'Go to dashboard',
      secondary: 'Contact support',
    },
  },
  gates: {
    label: 'Closer feature',
    title: 'Unlock with Closer',
    body: 'Get full digests, deeper scoring context, and faster execution for daily outbound.',
    benefits: [
      'Daily digest for your full target list',
      'More accounts and saved outputs',
      'Richer “why now” context + templates',
    ],
    ctaPrimary: 'Upgrade to Closer',
    ctaSecondary: 'See pricing',
    variants: {
      moreAccounts: {
        title: 'Increase your account limit',
        body: 'Monitor more targets and keep your daily shortlist strong.',
      },
      savedOutputs: {
        title: 'Save and reuse outputs',
        body: 'Store pitches and reports so you never start from scratch.',
      },
      advancedSignals: {
        title: 'Get faster signal coverage',
        body: 'Stay on top of triggers sooner and act while timing is fresh.',
      },
    },
  },
} as const

export type LeadIntelCopy = typeof COPY

