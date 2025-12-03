# Security Documentation

## Security Middleware

### Helmet.js

The backend uses [Helmet.js](https://helmetjs.github.io/) to secure HTTP headers and protect against common web vulnerabilities.

#### Enabled Security Features

1. **Content Security Policy (CSP)**
   - Prevents XSS attacks by controlling which resources can be loaded
   - Configured to allow:
     - Self-hosted resources
     - Inline styles (for compatibility)
     - HTTPS images
     - Data URIs for images

2. **X-Content-Type-Options**
   - Set to `nosniff`
   - Prevents MIME type sniffing

3. **X-Frame-Options**
   - Set to `DENY` (via frameSrc: 'none')
   - Prevents clickjacking attacks

4. **X-XSS-Protection**
   - Enabled by default
   - Provides XSS protection in older browsers

5. **Strict-Transport-Security (HSTS)**
   - Enforces HTTPS connections
   - Automatically enabled in production

6. **Cross-Origin Policies**
   - `crossOriginEmbedderPolicy`: Disabled for frontend compatibility
   - `crossOriginResourcePolicy`: Set to `cross-origin` for API access

#### Configuration

```javascript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
```

## Authentication & Authorization

### JWT Tokens
- Tokens stored in HTTP-only cookies
- Separate tokens for Users and Agents
- Token expiration: 7 days (configurable)
- Secret key stored in environment variables

### Password Security
- Passwords hashed using bcryptjs
- Salt rounds: 10
- Passwords never stored in plain text

### Role-Based Access Control (RBAC)
- Hierarchy: super-admin > admin > agent > user
- Middleware enforces role requirements
- Separate authentication flows for Users and Agents

## CORS Configuration

```javascript
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // Allow cookies
  })
);
```

## Rate Limiting

- In-memory rate limiting (development)
- TODO: Implement Redis-based rate limiting for production
- Default: 200 requests per 15 minutes

## Input Validation

- Joi schema validation for all inputs
- Mongoose schema validation
- URL validation for external links
- Email validation for user registration

## Database Security

- MongoDB connection with authentication
- Connection string stored in environment variables
- No direct database exposure to frontend

## Environment Variables

Required security-related environment variables:

```env
JWT_SECRET=your-secret-key-here
MONGODB_URI=mongodb+srv://...
FRONTEND_URL=https://yourdomain.com
COOKIE_DOMAIN=yourdomain.com
NODE_ENV=production
```

## Security Headers Response

When Helmet is enabled, the following headers are automatically added to all responses:

```
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=15552000; includeSubDomains
```

## Security Best Practices

1. ✅ Use HTTPS in production
2. ✅ Keep dependencies updated
3. ✅ Use environment variables for secrets
4. ✅ Implement rate limiting
5. ✅ Validate all inputs
6. ✅ Use secure HTTP headers (Helmet)
7. ⚠️ TODO: Add CSRF protection
8. ⚠️ TODO: Implement Redis for session storage
9. ⚠️ TODO: Add security audit logging
10. ⚠️ TODO: Implement API key rotation

## Vulnerability Reporting

If you discover a security vulnerability, please email: security@ticketagent.com

**Do not** create a public GitHub issue for security vulnerabilities.

## Security Audit

Last audit: Not performed yet
Next scheduled audit: TBD

## Compliance

- GDPR: Partial compliance (user data handling)
- OWASP Top 10: Addressed common vulnerabilities
- PCI DSS: Not applicable (no payment processing)

---

**Last Updated:** December 2, 2025
**Version:** 1.0.0
