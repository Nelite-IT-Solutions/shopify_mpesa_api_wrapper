# Configuration Reference

Complete reference for all configuration options.

---

## Backend Environment Variables

Create a `.env` file in the `mpesa-backend/` directory with these variables.

### Daraja API Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DARAJA_CONSUMER_KEY` | Yes | OAuth consumer key from Daraja portal | `abc123...` |
| `DARAJA_CONSUMER_SECRET` | Yes | OAuth consumer secret from Daraja portal | `xyz789...` |
| `DARAJA_SHORTCODE` | Yes | Your M-Pesa Till number | `174379` |
| `DARAJA_PASSKEY` | Yes | Lipa Na M-Pesa passkey from Safaricom | `bfb279...` |
| `DARAJA_CALLBACK_URL` | Yes | Public HTTPS URL for callbacks | `https://api.example.com/api/mpesa/callback` |
| `DARAJA_TRANSACTION_TYPE` | No | Transaction type (default: `CustomerBuyGoodsOnline`) | `CustomerBuyGoodsOnline` |
| `DARAJA_ENV` | Yes | Environment: `sandbox` or `production` | `sandbox` |

### Shopify Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SHOPIFY_STORE_DOMAIN` | Yes | Your Shopify store domain | `mystore.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Yes | Admin API access token | `shpat_xxx...` |

### Server Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No | Server port (default: `3000`) | `3000` |
| `NODE_ENV` | No | Environment (default: `development`) | `production` |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins | `https://mystore.com,https://mystore.myshopify.com` |

---

## Complete .env Example

```env
# ===========================================
# DARAJA API CONFIGURATION
# ===========================================

# Get these from https://developer.safaricom.co.ke
DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here

# Your M-Pesa Till Number (Buy Goods)
DARAJA_SHORTCODE=123456

# Passkey provided by Safaricom
DARAJA_PASSKEY=your_passkey_here

# Must be HTTPS and publicly accessible
DARAJA_CALLBACK_URL=https://api.yourdomain.com/api/mpesa/callback

# Transaction type for Till (Buy Goods)
DARAJA_TRANSACTION_TYPE=CustomerBuyGoodsOnline

# Environment: 'sandbox' for testing, 'production' for live
DARAJA_ENV=sandbox

# ===========================================
# SHOPIFY CONFIGURATION
# ===========================================

# Your store's myshopify.com domain
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com

# Admin API access token (from Shopify Private App)
# Requires scopes: write_orders, read_products, write_customers
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ===========================================
# SERVER CONFIGURATION
# ===========================================

# Port to run the server on
PORT=3000

# Environment: 'development' or 'production'
NODE_ENV=production

# Comma-separated list of allowed CORS origins
# Include both custom domain and myshopify.com domain
CORS_ORIGINS=https://yourdomain.com,https://your-store.myshopify.com

# ===========================================
# OPTIONAL: LOGGING
# ===========================================

# Log level: error, warn, info, debug
LOG_LEVEL=info
```

---

## Frontend Configuration

### mpesa-payment.js Settings

Edit `assets/mpesa-payment.js` in your Shopify theme:

```javascript
// Line 14 - Backend API URL
const MPESA_API_URL = 'https://api.yourdomain.com/api/mpesa';

// Line 17-18 - Polling settings
const POLL_INTERVAL = 3000;  // Poll every 3 seconds
const POLL_TIMEOUT = 120000; // Timeout after 2 minutes
```

| Setting | Default | Description |
|---------|---------|-------------|
| `MPESA_API_URL` | `https://your-backend-domain.com/api/mpesa` | Your backend API URL |
| `POLL_INTERVAL` | `3000` | Milliseconds between status checks |
| `POLL_TIMEOUT` | `120000` | Total milliseconds before timeout |

---

## Daraja API URLs

The backend automatically selects the correct URL based on `DARAJA_ENV`:

| Environment | Base URL |
|-------------|----------|
| `sandbox` | `https://sandbox.safaricom.co.ke` |
| `production` | `https://api.safaricom.co.ke` |

---

## Transaction Types

| Type | Use Case | DARAJA_TRANSACTION_TYPE |
|------|----------|-------------------------|
| **Till Number (Buy Goods)** | Retail payments | `CustomerBuyGoodsOnline` |
| **Paybill** | Bill payments with account number | `CustomerPayBillOnline` |

This integration is configured for **Till Number (Buy Goods)**.

---

## Shopify API Scopes

When creating your Shopify Private App, enable these scopes:

| Scope | Purpose |
|-------|---------|
| `write_orders` | Create orders after payment |
| `read_orders` | Read order details |
| `write_customers` | Create customer records |
| `read_customers` | Read customer info |
| `read_products` | Access product/variant data |
| `read_inventory` | Check stock availability |

---

## CORS Configuration

### Why CORS is Important

CORS (Cross-Origin Resource Sharing) restricts which domains can call your API. This prevents unauthorized websites from using your M-Pesa integration.

### Configuring CORS

In your `.env` file:

```env
# Single domain
CORS_ORIGINS=https://yourdomain.com

# Multiple domains (comma-separated, no spaces)
CORS_ORIGINS=https://yourdomain.com,https://your-store.myshopify.com

# Include all domains that host your store
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://your-store.myshopify.com
```

### Common CORS Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `No 'Access-Control-Allow-Origin'` | Domain not in CORS_ORIGINS | Add domain to .env |
| `CORS preflight failed` | OPTIONS request blocked | Check Nginx config |
| Works on myshopify.com but not custom domain | Custom domain not added | Add custom domain to CORS_ORIGINS |

---

## Security Recommendations

### Production Checklist

1. **Use HTTPS everywhere**
   - Backend must use HTTPS (Daraja requires it)
   - Frontend already on HTTPS via Shopify

2. **Restrict CORS origins**
   - Only allow your specific domains
   - Never use `*` (allow all) in production

3. **Protect credentials**
   - Never commit `.env` to git
   - Use environment variables on VPS
   - Rotate credentials periodically

4. **Monitor for abuse**
   - Watch for unusual transaction patterns
   - Implement rate limiting if needed

### Nginx Security Headers

Add to your Nginx config:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

---

## Testing Configuration

### Sandbox Credentials

Get sandbox credentials from [developer.safaricom.co.ke](https://developer.safaricom.co.ke):

1. Create account / Login
2. Create new app
3. Add "Lipa Na M-Pesa Sandbox" product
4. Get Consumer Key & Secret from app page

### Sandbox Test Numbers

| Phone Number | Purpose |
|--------------|---------|
| `254708374149` | Default test number |
| Your registered number | If you added it in Daraja portal |

### Switching to Production

1. Update `.env`:
   ```env
   DARAJA_ENV=production
   DARAJA_CONSUMER_KEY=production_key
   DARAJA_CONSUMER_SECRET=production_secret
   DARAJA_SHORTCODE=actual_till_number
   DARAJA_PASSKEY=production_passkey
   ```

2. Restart server:
   ```bash
   pm2 restart mpesa-api
   ```

3. Test with small amount (e.g., KES 10)

---

## Environment-Specific Settings

### Development

```env
NODE_ENV=development
DARAJA_ENV=sandbox
PORT=3000
LOG_LEVEL=debug
```

### Staging

```env
NODE_ENV=staging
DARAJA_ENV=sandbox
PORT=3000
LOG_LEVEL=info
CORS_ORIGINS=https://staging.yourdomain.com
```

### Production

```env
NODE_ENV=production
DARAJA_ENV=production
PORT=3000
LOG_LEVEL=warn
CORS_ORIGINS=https://yourdomain.com,https://your-store.myshopify.com
```
