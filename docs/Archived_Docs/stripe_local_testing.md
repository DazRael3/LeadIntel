# Stripe Local Testing Guide

This guide explains how to test Stripe webhooks locally during development.

## Prerequisites

- Stripe CLI installed ([Installation Guide](https://stripe.com/docs/stripe-cli))
- Stripe account (test mode)
- `.env.local` file configured

## Setup

### 1. Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (using Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Or download from: https://github.com/stripe/stripe-cli/releases
```

### 2. Login to Stripe CLI

```bash
stripe login
```

This will open a browser window to authenticate with your Stripe account.

### 3. Start the Webhook Listener

In a separate terminal, run:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

This command will:
- Forward Stripe webhook events to your local server
- Display webhook events in the terminal
- **Output a webhook signing secret** (looks like `whsec_...`)

### 4. Configure Environment Variables

Copy the webhook signing secret from step 3 and add it to your `.env.local` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Copy from stripe listen output
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Important**: The webhook secret changes each time you run `stripe listen`, so you'll need to update `.env.local` if you restart the listener.

### 5. Start Your Development Server

```bash
npm run dev
```

## Testing the Checkout Flow

1. Navigate to the pricing page: `http://localhost:3000/pricing`
2. Click "Subscribe Now" (you must be logged in)
3. Complete the checkout using Stripe test card: `4242 4242 4242 4242`
   - Use any future expiry date (e.g., `12/34`)
   - Use any 3-digit CVC
   - Use any postal code
4. After successful checkout, check:
   - The `/success` page loads
   - Your user's `subscription_tier` is set to `'pro'` in the database
   - The webhook terminal shows `checkout.session.completed` event

## Testing Subscription Cancellation

You can test subscription cancellation by:

1. **Using Stripe Dashboard**:
   - Go to https://dashboard.stripe.com/test/subscriptions
   - Find your test subscription
   - Click "Cancel subscription"
   - The webhook should fire `customer.subscription.deleted`
   - Your user's `subscription_tier` should be set back to `'free'`

2. **Using Stripe CLI**:
   ```bash
   stripe subscriptions cancel <subscription_id>
   ```

## Webhook Events Handled

- `checkout.session.completed` - Sets user tier to `'pro'`
- `customer.subscription.deleted` - Sets user tier to `'free'`

## Troubleshooting

### Webhook not receiving events

- Ensure `stripe listen` is running
- Check that `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen`
- Verify the webhook URL is correct: `localhost:3000/api/webhook`
- Check the terminal running `stripe listen` for any errors

### Signature verification failed

- Make sure `STRIPE_WEBHOOK_SECRET` is set correctly
- Restart your Next.js dev server after updating `.env.local`
- The webhook secret changes each time you restart `stripe listen`

### User tier not updating

- Check the Supabase database directly to verify the update
- Check the Next.js server logs for webhook handler errors
- Verify the user ID is correctly set in the checkout session metadata

## Production Setup

For production, you'll need to:

1. Create a webhook endpoint in Stripe Dashboard
2. Set the endpoint URL to: `https://yourdomain.com/api/webhook`
3. Select the events: `checkout.session.completed` and `customer.subscription.deleted`
4. Copy the webhook signing secret and add it to your production environment variables
