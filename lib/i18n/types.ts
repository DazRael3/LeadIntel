export type SupportedLocale = 'en-US'

export type LocalePreferenceSource = 'user' | 'workspace' | 'browser' | 'default'

export type LocaleResolution = {
  locale: SupportedLocale
  source: LocalePreferenceSource
}

