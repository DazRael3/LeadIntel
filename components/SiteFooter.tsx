'use client'

import Link from 'next/link'

import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { buildMailto } from '@/lib/mailto'
import { track } from '@/lib/analytics'

export function SiteFooter() {
  const mailto = buildMailto(SUPPORT_EMAIL, 'LeadIntel Support')
  const onFooterClick = (args: { href: string; label: string; group: 'product' | 'trust' | 'contact' | 'legal' }): void => {
    track('public_footer_link_clicked', { href: args.href, label: args.label, group: args.group })
  }

  return (
    <footer className="border-t border-cyan-500/20 bg-card/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="text-sm font-semibold text-foreground">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground" href="/" onClick={() => onFooterClick({ href: '/', label: 'Home', group: 'product' })}>
                  Home
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/pricing"
                  onClick={() => onFooterClick({ href: '/pricing', label: 'Pricing', group: 'product' })}
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/use-cases"
                  onClick={() => onFooterClick({ href: '/use-cases', label: 'Use Cases', group: 'product' })}
                >
                  Use Cases
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/how-scoring-works"
                  onClick={() => onFooterClick({ href: '/how-scoring-works', label: 'How Scoring Works', group: 'product' })}
                >
                  How Scoring Works
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/support"
                  onClick={() => onFooterClick({ href: '/support', label: 'Support', group: 'product' })}
                >
                  Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground">Trust</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/security"
                  onClick={() => onFooterClick({ href: '/security', label: 'Security', group: 'trust' })}
                >
                  Security
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/privacy"
                  onClick={() => onFooterClick({ href: '/privacy', label: 'Privacy', group: 'trust' })}
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/terms" onClick={() => onFooterClick({ href: '/terms', label: 'Terms', group: 'trust' })}>
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/acceptable-use"
                  onClick={() => onFooterClick({ href: '/acceptable-use', label: 'Acceptable Use', group: 'trust' })}
                >
                  Acceptable Use
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/subprocessors"
                  onClick={() => onFooterClick({ href: '/subprocessors', label: 'Subprocessors', group: 'trust' })}
                >
                  Subprocessors
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/dpa" onClick={() => onFooterClick({ href: '/dpa', label: 'DPA', group: 'trust' })}>
                  DPA
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/status"
                  onClick={() => onFooterClick({ href: '/status', label: 'Status', group: 'trust' })}
                >
                  Status
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/changelog"
                  onClick={() => onFooterClick({ href: '/changelog', label: 'Changelog', group: 'trust' })}
                >
                  Changelog
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/roadmap"
                  onClick={() => onFooterClick({ href: '/roadmap', label: 'Roadmap', group: 'trust' })}
                >
                  Roadmap
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-foreground"
                  href="/version"
                  onClick={() => onFooterClick({ href: '/version', label: 'Version', group: 'trust' })}
                >
                  Version
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground">Contact</div>
            <div className="mt-3 text-sm text-muted-foreground">
              <a className="hover:text-foreground" href={mailto} onClick={() => onFooterClick({ href: 'mailto', label: 'Support email', group: 'contact' })}>
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              <Link
                className="hover:text-foreground"
                href="/support#email-preferences"
                onClick={() => onFooterClick({ href: '/support#email-preferences', label: 'Email preferences', group: 'contact' })}
              >
                Email preferences
              </Link>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Billing is handled by Stripe. Authentication is handled by Supabase.
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} LeadIntel</div>
          <div className="flex items-center gap-4">
            <Link className="hover:text-foreground" href="/privacy" onClick={() => onFooterClick({ href: '/privacy', label: 'Privacy', group: 'legal' })}>
              Privacy
            </Link>
            <Link className="hover:text-foreground" href="/terms" onClick={() => onFooterClick({ href: '/terms', label: 'Terms', group: 'legal' })}>
              Terms
            </Link>
            <a className="hover:text-foreground" href={mailto} onClick={() => onFooterClick({ href: 'mailto', label: 'Contact', group: 'contact' })}>
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

