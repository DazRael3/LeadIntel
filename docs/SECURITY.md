# Security Guide

Security policies, procedures, and best practices for LeadIntel.

---

## Overview

This document outlines security policies for:
- **Key Rotation**: API keys, secrets, and credentials
- **Least Privilege**: Access control and permissions
- **Incident Response**: Security incident handling

---

## Key Rotation Policy

### Rotation Schedule

| Credential Type | Rotation Frequency | Method |
|----------------|-------------------|---------|
| **API Keys** (OpenAI, Resend, Clearbit) | Every 90 days | Manual rotation |
| **Stripe Keys** | Every 180 days | Manual rotation |
| **Supabase Service Role Key** | Every 90 days | Manual rotation |
| **Webhook Secrets** | When compromised or every 180 days | Manual rotation |
| **Database Passwords** | Managed by Supabase | Automatic (Supabase handles) |
| **Session Tokens** | Automatic | Handled by Supabase Auth |

### Rotation Procedures

#### OpenAI API Key Rotation

1. **Generate new key:**
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create new API key
   - Copy new key

2. **Update environment variables:**
   - **Staging**: Update `OPENAI_API_KEY` in Vercel staging environment
   - **Production**: Update `OPENAI_API_KEY` in Vercel production environment
   - Deploy or restart application

3. **Verify:**
   - Test API calls work with new key
   - Monitor for errors
   - **Revoke old key** after 24-48 hours (once confirmed new key works)

4. **Document:**
   - Update rotation log
   - Note date of rotation

#### Stripe Key Rotation

**Secret Key Rotation:**

1. **Generate new key:**
   - Stripe Dashboard → Developers → API keys
   - Create new secret key
   - Copy new key

2. **Update environment variables:**
   - Update `STRIPE_SECRET_KEY` in Vercel
   - Deploy application

3. **Verify:**
   - Test checkout flow
   - Verify webhooks still work
   - **Revoke old key** after 24-48 hours

**Publishable Key Rotation:**

1. **Generate new key:**
   - Stripe Dashboard → Developers → API keys
   - Create new publishable key
   - Copy new key

2. **Update environment variables:**
   - Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel
   - Deploy application

3. **Verify:**
   - Test checkout flow
   - **Revoke old key** after 24-48 hours

**Webhook Secret Rotation:**

1. **Create new webhook endpoint** (or regenerate secret if supported):
   - Stripe Dashboard → Developers → Webhooks
   - Create new endpoint or regenerate secret
   - Copy new signing secret

2. **Update environment variables:**
   - Update `STRIPE_WEBHOOK_SECRET` in Vercel
   - Deploy application

3. **Verify:**
   - Test webhook delivery
   - Monitor webhook logs
   - **Delete old endpoint** after 24-48 hours

#### Supabase Service Role Key Rotation

1. **Generate new key:**
   - Supabase Dashboard → Settings → API
   - Regenerate service role key
   - Copy new key (⚠️ **Only shown once**)

2. **Update environment variables:**
   - Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel
   - Deploy application

3. **Verify:**
   - Test admin operations (webhook handlers, etc.)
   - Monitor for errors
   - **Revoke old key** after 24-48 hours

#### Resend API Key Rotation

1. **Generate new key:**
   - Resend Dashboard → API Keys
   - Create new API key
   - Copy new key

2. **Update environment variables:**
   - Update `RESEND_API_KEY` in Vercel
   - Deploy application

3. **Verify:**
   - Test email sending
   - Monitor email delivery
   - **Revoke old key** after 24-48 hours

#### Clearbit API Key Rotation

1. **Generate new key:**
   - Clearbit Dashboard → API Keys
   - Create new API key
   - Copy new key

2. **Update environment variables:**
   - Update `CLEARBIT_REVEAL_API_KEY` and `CLEARBIT_API_KEY` in Vercel
   - Deploy application

3. **Verify:**
   - Test company enrichment
   - Test Ghost Reveal
   - **Revoke old key** after 24-48 hours

### Emergency Rotation

If a key is **compromised or suspected of compromise**:

1. **Immediately revoke the key** in the provider dashboard
2. **Generate new key** immediately
3. **Update environment variables** and deploy
4. **Verify** functionality
5. **Document incident** (see Incident Response)

### Rotation Log

Maintain a rotation log (internal document or spreadsheet):

| Date | Credential Type | Environment | Rotated By | Notes |
|------|----------------|-------------|------------|-------|
| 2025-01-15 | OpenAI API Key | Production | [Name] | Routine rotation |
| 2025-01-10 | Stripe Secret Key | Staging | [Name] | Routine rotation |

---

## Least Privilege Principle

### Access Control

#### Environment Access

- **Development**: All developers
- **Staging**: Developers + QA team
- **Production**: Senior engineers + DevOps only

#### Credential Access

**Who can access production credentials:**

- **Supabase Service Role Key**: Senior engineers only
- **Stripe Secret Key**: Senior engineers + finance team (read-only for finance)
- **OpenAI API Key**: All engineers (monitor usage)
- **Webhook Secrets**: Senior engineers only
- **Database Access**: Senior engineers only (via Supabase Dashboard)

#### Code Access

- **Repository**: All team members (read)
- **Main branch**: Senior engineers only (write)
- **Production deployments**: Senior engineers only

### Database Permissions

#### Row Level Security (RLS)

All tables use RLS policies to enforce least privilege:

- **Users can only access their own data:**
  ```sql
  CREATE POLICY "Users can view their own data"
    ON api.users FOR SELECT
    USING (auth.uid() = id);
  ```

- **Service role key** (used in webhooks) bypasses RLS but is:
  - Server-side only (never exposed to client)
  - Used only for admin operations (subscription updates, etc.)
  - Monitored for unusual activity

#### Database User Permissions

- **Application uses `anon` key** for client-side operations (respects RLS)
- **Service role key** only used server-side for admin operations
- **No direct database access** for application users

### API Permissions

#### Supabase API

- **Anon key**: Public, but RLS enforces access control
- **Service role key**: Server-side only, admin operations

#### Stripe API

- **Publishable key**: Public (client-side)
- **Secret key**: Server-side only
- **Webhook secret**: Server-side only

### Environment Variable Security

1. **Never commit secrets to Git:**
   - Use `.env.local` (gitignored)
   - Use Vercel environment variables
   - Never log secrets (see `.cursorrules`)

2. **Separate environments:**
   - Staging and production use different keys
   - Never share keys between environments

3. **Access control:**
   - Limit who can view/edit environment variables in Vercel
   - Use Vercel team permissions

### Third-Party Service Permissions

#### Supabase

- **Service role key**: Full database access (server-side only)
- **Anon key**: Limited by RLS policies

#### Stripe

- **Read-only access** where possible
- **Webhook endpoints** only receive necessary events
- **Customer portal** limits user actions

#### OpenAI

- **API key**: Full access (monitor usage)
- **Rate limits** configured to prevent abuse
- **Usage alerts** set up

---

## Incident Response

### Incident Classification

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| **Critical** | Data breach, service compromise | Immediate | API key leaked, database breach |
| **High** | Security vulnerability, unauthorized access | Within 1 hour | Suspicious activity, failed auth attempts |
| **Medium** | Potential security issue | Within 4 hours | Unusual API usage, error spikes |
| **Low** | Minor security concern | Within 24 hours | Deprecated dependency, minor config issue |

### Incident Response Procedure

#### Step 1: Detection

**Sources of detection:**
- Error monitoring (Sentry, etc.)
- Security alerts (Stripe, Supabase, etc.)
- User reports
- Automated security scans

#### Step 2: Assessment

1. **Determine severity:**
   - Is data at risk?
   - Is service compromised?
   - How many users affected?

2. **Gather information:**
   - What happened?
   - When did it occur?
   - What systems are affected?
   - What evidence is available?

#### Step 3: Containment

**Immediate actions:**

1. **If credentials compromised:**
   - Revoke compromised keys immediately
   - Generate new keys
   - Update environment variables
   - Deploy fix

2. **If service compromised:**
   - Disable affected features (if possible)
   - Block suspicious IPs/accounts
   - Review access logs

3. **If data breach:**
   - Assess scope of data exposure
   - Notify affected users (if required by law)
   - Document what data was accessed

#### Step 4: Eradication

1. **Fix root cause:**
   - Patch vulnerability
   - Update compromised credentials
   - Remove unauthorized access

2. **Verify fix:**
   - Test that issue is resolved
   - Monitor for recurrence
   - Review logs

#### Step 5: Recovery

1. **Restore service:**
   - Deploy fixes
   - Verify functionality
   - Monitor for errors

2. **Communicate:**
   - Notify team
   - Update status page (if applicable)
   - User communication (if needed)

#### Step 6: Post-Incident

1. **Document incident:**
   - What happened
   - Root cause
   - Actions taken
   - Lessons learned

2. **Review and improve:**
   - Update security procedures
   - Improve monitoring
   - Conduct post-mortem

### Incident Response Contacts

**Internal Contacts:**
- **Security Lead**: [Name/Email]
- **Engineering Lead**: [Name/Email]
- **DevOps Lead**: [Name/Email]

**External Contacts:**
- **Supabase Support**: support@supabase.com
- **Stripe Support**: support@stripe.com
- **Vercel Support**: support@vercel.com

### Common Incident Scenarios

#### Scenario 1: API Key Leaked

**Detection:**
- Unusual API usage
- Provider alerts
- Error logs showing unauthorized access

**Response:**
1. Immediately revoke key in provider dashboard
2. Generate new key
3. Update environment variables
4. Deploy fix
5. Review access logs to determine scope
6. Document incident

#### Scenario 2: Database Breach

**Detection:**
- Unusual database queries
- Supabase security alerts
- User reports of data exposure

**Response:**
1. Assess scope of breach
2. Review RLS policies
3. Check access logs
4. Rotate service role key (if compromised)
5. Notify affected users (if required)
6. Document incident

#### Scenario 3: Webhook Compromise

**Detection:**
- Failed webhook signature verification
- Unusual webhook events
- Stripe security alerts

**Response:**
1. Verify webhook secret is correct
2. Check webhook endpoint security
3. Review webhook logs
4. Rotate webhook secret if needed
5. Document incident

---

## Security Best Practices

### Code Security

1. **Never log secrets:**
   - Use `.cursorrules` guidelines
   - Check existence: `!!process.env.KEY` (not value)
   - Sanitize logs before output

2. **Input validation:**
   - Validate all user input
   - Use Zod schemas for API routes
   - Sanitize data before database operations

3. **Error handling:**
   - Never expose internal errors to users
   - Log errors securely (no secrets)
   - Use standardized error responses

### Infrastructure Security

1. **Environment variables:**
   - Use Vercel environment variables (encrypted)
   - Never commit to Git
   - Rotate regularly

2. **Database security:**
   - RLS enabled on all tables
   - Service role key server-side only
   - Regular backups

3. **API security:**
   - Rate limiting (to be implemented)
   - Input validation
   - Authentication required

### Monitoring

1. **Error tracking:**
   - Sentry or similar
   - Alert on security-related errors
   - Regular review of error logs

2. **Access monitoring:**
   - Review Supabase access logs
   - Monitor Stripe webhook deliveries
   - Check API usage patterns

3. **Security scans:**
   - Dependency vulnerability scans
   - Regular security audits
   - Penetration testing (annual)

---

## Compliance

### Data Protection

- **GDPR**: User data handling, right to deletion
- **SOC 2**: Security controls (if applicable)
- **PCI DSS**: Payment data handling (Stripe handles)

### Data Retention

- **User data**: Retained while account is active
- **Deleted accounts**: Data removed within 30 days
- **Logs**: Retained for 90 days (for debugging)

---

## Security Checklist

Before production deployment:

- [ ] All API keys are rotated and current
- [ ] Environment variables are set correctly
- [ ] RLS policies are enabled on all tables
- [ ] Service role key is server-side only
- [ ] Webhook secrets are configured
- [ ] Error tracking is set up
- [ ] Monitoring and alerts are configured
- [ ] Security incident response plan is documented
- [ ] Team members know incident response procedures
- [ ] Regular security reviews are scheduled

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/going-to-production#security)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Stripe Security](https://stripe.com/docs/security)

---

## Security Contact

For security concerns or incidents:
- **Email**: security@leadintel.com (or your security contact)
- **Internal**: Use team communication channel
- **Emergency**: Follow incident response procedure
