import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import PricingClientPage from './PricingClientPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Pricing | LeadIntel',
  description: 'Outcome-focused pricing for lead generation, AI outreach, and campaign tracking.',
  alternates: { canonical: 'https://raelinfo.com/pricing' },
  openGraph: {
    title: 'Pricing | LeadIntel',
    description: 'Outcome-focused pricing for lead generation, AI outreach, and campaign tracking.',
    url: 'https://raelinfo.com/pricing',
    images: [
      {
        url: '/api/og?title=Pricing&subtitle=Why-now%20signals%20%E2%86%92%20send-ready%20drafts',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function PricingPage() {
  const offersJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'LeadIntel Pricing',
    url: 'https://raelinfo.com/pricing',
    isPartOf: { '@type': 'WebSite', name: 'LeadIntel', url: 'https://raelinfo.com' },
    mainEntity: {
      '@type': 'OfferCatalog',
      name: 'LeadIntel plans',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Free',
          price: '0',
          priceCurrency: 'USD',
          url: 'https://raelinfo.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Pro',
          price: '79',
          priceCurrency: 'USD',
          url: 'https://raelinfo.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Pro+',
          price: '149',
          priceCurrency: 'USD',
          url: 'https://raelinfo.com/pricing',
        },
        {
          '@type': 'Offer',
          name: 'Team (base)',
          price: '249',
          priceCurrency: 'USD',
          url: 'https://raelinfo.com/pricing',
        },
      ],
    },
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What does “Annual (save 2 months)” mean?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Annual billing is priced at 10× the monthly rate. You get the same plan, paid once per year.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I cancel anytime?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Use “Manage billing” in the dashboard to open Stripe and cancel or adjust your subscription.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do Team seats work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Team includes a base subscription plus a per-seat price. Set the seat count at checkout and change it later in Stripe.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is my data safe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Billing runs on Stripe. Authentication runs on Supabase. LeadIntel avoids exposing secrets to the client and enforces structured API responses across the app.',
        },
      },
    ],
  }

  return (
    <>
      <PageViewTrack event="pricing_variant_seen" props={{ surface: 'pricing_page' }} />
      <JsonLd data={offersJsonLd} />
      <JsonLd data={faqJsonLd} />
      <PricingClientPage />
    </>
  )
}
