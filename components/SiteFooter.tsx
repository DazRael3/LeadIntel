import Link from 'next/link'

import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { buildMailto } from '@/lib/mailto'

export function SiteFooter() {
  const mailto = buildMailto(SUPPORT_EMAIL, 'LeadIntel Support')

  return (
    <footer className="border-t border-cyan-500/20 bg-card/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="text-sm font-semibold text-foreground">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground" href="/">
                  Home
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/pricing">
                  Pricing
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/use-cases">
                  Use Cases
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/how-scoring-works">
                  How Scoring Works
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/support">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground">Trust</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground" href="/security">
                  Security
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/privacy">
                  Privacy
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/terms">
                  Terms
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/acceptable-use">
                  Acceptable Use
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/subprocessors">
                  Subprocessors
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/dpa">
                  DPA
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/status">
                  Status
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/changelog">
                  Changelog
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/roadmap">
                  Roadmap
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/version">
                  Version
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-foreground">Contact</div>
            <div className="mt-3 text-sm text-muted-foreground">
              <a className="hover:text-foreground" href={mailto}>
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              <Link className="hover:text-foreground" href="/settings/notifications">
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
            <Link className="hover:text-foreground" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-foreground" href="/terms">
              Terms
            </Link>
            <a className="hover:text-foreground" href={mailto}>
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

