# Observability and Error Tracking

This document describes the observability setup for LeadIntel, including error tracking, request correlation, and monitoring recommendations.

## Overview

LeadIntel uses **Sentry** for error tracking and request correlation for debugging production issues.

### Features

- ✅ **Error Tracking**: Automatic capture of exceptions and errors
- ✅ **Request Correlation**: Unique request IDs for tracing requests across logs
- ✅ **PII Protection**: Automatic filtering of sensitive data (passwords, tokens, API keys)
- ✅ **Environment-Based**: Only enabled in production or when explicitly configured
- ✅ **Performance Monitoring**: Transaction tracing with configurable sample rate

## Configuration

### Environment Variables

Add to `.env.local` or production environment:

```bash
# Sentry DSN (get from https://sentry.io/settings/projects/)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Optional: Environment name (defaults to NODE_ENV)
SENTRY_ENVIRONMENT=production

# Optional: Performance monitoring sample rate (0.0 to 1.0, default: 0.1 = 10%)
SENTRY_TRACES_SAMPLE_RATE=0.1

# Client-side Sentry (optional, for browser errors)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Getting Sentry DSN

1. Sign up at https://sentry.io
2. Create a new project (Next.js)
3. Copy the DSN from project settings
4. Add to environment variables

## Request Correlation

### Request IDs

Every API request gets a unique request ID:
- Format: `timestamp-random` (e.g., `1704067200-a1b2c3d4`)
- Included in error responses as `error.requestId`
- Included in response headers as `X-Request-ID`
- Attached to Sentry events for correlation

### Usage in API Routes

```typescript
import { getRequestId } from '@/lib/api/with-request-id'
import { fail, asHttpError } from '@/lib/api/http'

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  
  try {
    // ... your code
  } catch (error) {
    return asHttpError(error, '/api/example', user?.id, bridge, requestId)
  }
}
```

### Error Response Format

All error responses include `requestId`:

```json
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "1704067200-a1b2c3d4"
  }
}
```

## PII and Secret Protection

Sentry is configured to automatically filter sensitive data:

### Filtered Data

- **Request Bodies**: Removed entirely (may contain passwords, tokens)
- **Sensitive Headers**: `authorization`, `cookie`, `x-api-key`, `stripe-signature`
- **User Data**: Only user ID is kept, email/name removed
- **Tags**: Email, password, token tags removed
- **Environment Variables**: Never logged or captured

### What IS Captured

- Error messages and stack traces
- Request URL and method
- Route name
- User ID (not email)
- Request ID
- Error codes
- Non-sensitive metadata

## Sentry Dashboards

### Recommended Dashboards

1. **Error Rate Dashboard**
   - Track error rate over time
   - Alert when error rate exceeds threshold
   - Filter by environment (production vs staging)

2. **Error Distribution**
   - Group errors by route/endpoint
   - Identify most common error types
   - Track error trends

3. **Performance Dashboard**
   - API response times
   - Slowest endpoints
   - Transaction traces

4. **User Impact Dashboard**
   - Errors by user ID
   - Affected user count
   - Error frequency per user

### Creating Dashboards

1. Go to Sentry → Dashboards
2. Create new dashboard
3. Add widgets:
   - **Error Count**: Total errors over time
   - **Error Rate**: Errors per minute
   - **Top Errors**: Most frequent errors
   - **Error by Route**: Errors grouped by API route
   - **Performance**: P95/P99 response times

## Alerts

### Recommended Alerts

1. **High Error Rate**
   - Condition: Error rate > 10 errors/minute
   - Action: Send to Slack/email
   - Severity: Critical

2. **New Error Type**
   - Condition: New error fingerprint detected
   - Action: Send to Slack
   - Severity: Warning

3. **Critical Route Failure**
   - Condition: Error rate > 50% for `/api/generate-pitch`
   - Action: Page on-call engineer
   - Severity: Critical

4. **Performance Degradation**
   - Condition: P95 response time > 5 seconds
   - Action: Send to Slack
   - Severity: Warning

### Setting Up Alerts

1. Go to Sentry → Alerts
2. Create new alert rule
3. Configure conditions:
   - **Trigger**: Error count, error rate, or performance
   - **Threshold**: Set based on your SLA
   - **Time Window**: 5-15 minutes
4. Configure actions:
   - **Slack**: Send to #alerts channel
   - **Email**: Send to on-call team
   - **PagerDuty**: For critical alerts

## Local Validation

### Testing Error Capture (Development)

1. **Set up test Sentry project** (optional):
   ```bash
   SENTRY_DSN=https://test@test.ingest.sentry.io/test
   ```

2. **Trigger a test error**:
   ```typescript
   // In any API route
   throw new Error('Test error for Sentry validation')
   ```

3. **Verify capture is gated**:
   - In development: Errors should NOT be sent to Sentry (unless DSN is set)
   - Check Sentry dashboard: Should see test error if DSN is configured
   - Check console: Should see error logged locally

### Testing Request ID

1. **Make API request**:
   ```bash
   curl -X POST http://localhost:3000/api/generate-pitch \
     -H "Content-Type: application/json" \
     -d '{"companyUrl": "https://example.com"}'
   ```

2. **Check response headers**:
   ```bash
   # Should see X-Request-ID header
   X-Request-ID: 1704067200-a1b2c3d4
   ```

3. **Check error response** (if error occurs):
   ```json
   {
     "ok": false,
     "error": {
       "code": "INTERNAL_ERROR",
       "message": "...",
       "requestId": "1704067200-a1b2c3d4"
     }
   }
   ```

### Testing PII Filtering

1. **Trigger error with sensitive data**:
   ```typescript
   // This should NOT capture the password
   throw new Error('Login failed for user with password: secret123')
   ```

2. **Check Sentry event**:
   - Request body should be empty
   - Authorization headers should be removed
   - User email should not appear
   - Only user ID should be present

## Production Checklist

- [ ] Sentry DSN configured in production environment
- [ ] Alerts configured for critical errors
- [ ] Dashboards set up for monitoring
- [ ] On-call team has Sentry access
- [ ] Error response format includes requestId
- [ ] PII filtering verified
- [ ] Performance monitoring enabled
- [ ] Sample rate tuned (10% default)

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN**: Verify `SENTRY_DSN` is set correctly
2. **Check Environment**: Sentry only enabled in production or if DSN is set
3. **Check Ignore List**: Error may be in `ignoreErrors` list
4. **Check Network**: Firewall may be blocking Sentry API

### Request IDs Missing

1. **Check Import**: Ensure `getRequestId()` is called in route handler
2. **Check Response**: Verify `requestId` is passed to `fail()` or `asHttpError()`
3. **Check Headers**: Response should include `X-Request-ID` header

### Too Many Events

1. **Adjust Sample Rate**: Reduce `SENTRY_TRACES_SAMPLE_RATE`
2. **Add to Ignore List**: Add non-actionable errors to `ignoreErrors`
3. **Filter by Environment**: Only capture production errors

## Best Practices

1. **Always include requestId** in error responses
2. **Use structured logging** with requestId for correlation
3. **Review Sentry weekly** to identify patterns
4. **Set up alerts** for critical errors
5. **Monitor performance** trends
6. **Never log secrets** (Sentry filters help, but be careful)
7. **Test error capture** in staging before production

## Additional Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)
- [Request Correlation Guide](https://docs.sentry.io/product/sentry-basics/tracing/distributed-tracing/)
