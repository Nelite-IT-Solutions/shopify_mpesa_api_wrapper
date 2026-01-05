# Troubleshooting Guide

Common issues and solutions for the M-Pesa integration.

---

## Quick Diagnostics

Run these commands on your VPS to quickly diagnose issues:

```bash
# Check if backend is running
pm2 status

# View recent logs
pm2 logs mpesa-api --lines 50

# Test health endpoint
curl https://api.yourdomain.com/health

# Check Nginx status
sudo systemctl status nginx

# Check SSL certificate
sudo certbot certificates
```

---

## Frontend Issues

### Issue: "Unable to connect to payment server"

**Symptoms:**
- Error appears when clicking "Pay with M-Pesa"
- Network request fails in browser console

**Causes & Solutions:**

1. **Backend not running**
   ```bash
   pm2 status
   pm2 restart mpesa-api
   ```

2. **Wrong API URL in frontend**
   - Open `assets/mpesa-payment.js` in Shopify
   - Check line 14: `const MPESA_API_URL = '...'`
   - Ensure it matches your actual backend URL

3. **CORS not configured**
   - Check `.env` on VPS:
     ```env
     CORS_ORIGINS=https://yourdomain.com,https://yourstore.myshopify.com
     ```
   - Include both your custom domain and `.myshopify.com` domain

4. **Nginx not proxying correctly**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **SSL certificate issue**
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

---

### Issue: Form validation errors

**Symptoms:**
- Red error messages on form fields
- Submit button not working

**Solutions:**

1. **Phone number format**
   - Enter as: `0712345678` or `254712345678`
   - Must be valid Kenyan mobile number

2. **Required fields**
   - Full Name: minimum 2 characters
   - Address: minimum 5 characters
   - City: minimum 2 characters
   - County: must select from dropdown

3. **Email format**
   - Optional, but if provided must be valid format

---

### Issue: M-Pesa button not showing

**Symptoms:**
- No M-Pesa section visible on cart page

**Solutions:**

1. **Check if snippet is included**
   - Verify `sections/main-cart-footer.liquid` has:
     ```liquid
     {% render 'mpesa-checkout-form' %}
     ```

2. **Check if CSS is loaded**
   - Verify the file has:
     ```liquid
     {{ 'mpesa-payment.css' | asset_url | stylesheet_tag }}
     ```

3. **Empty cart**
   - M-Pesa section hides when cart is empty
   - Add items to cart to see it

4. **Check browser console**
   - Open Developer Tools (F12)
   - Look for JavaScript errors

---

## Payment Issues

### Issue: STK Push not received on phone

**Symptoms:**
- Modal shows "Waiting for payment..."
- No prompt on customer's phone
- Eventually times out

**Causes & Solutions:**

1. **Wrong phone number format**
   - Backend converts to `254XXXXXXXXX`
   - Check logs: `pm2 logs mpesa-api`

2. **Invalid Daraja credentials**
   - Verify in `.env`:
     ```env
     DARAJA_CONSUMER_KEY=correct_key
     DARAJA_CONSUMER_SECRET=correct_secret
     DARAJA_SHORTCODE=your_till
     DARAJA_PASSKEY=your_passkey
     ```

3. **Wrong environment**
   - Sandbox: `DARAJA_ENV=sandbox`
   - Production: `DARAJA_ENV=production`
   - Credentials must match environment

4. **Phone not registered for M-Pesa**
   - Customer must have active M-Pesa account

5. **Network issues**
   - Check if VPS can reach Safaricom API:
     ```bash
     curl https://sandbox.safaricom.co.ke
     curl https://api.safaricom.co.ke
     ```

---

### Issue: "Payment timed out"

**Symptoms:**
- STK Push was sent
- Customer entered PIN
- Frontend shows timeout error

**Causes & Solutions:**

1. **Callback URL not accessible**
   ```bash
   # Test callback endpoint
   curl -X POST https://api.yourdomain.com/api/mpesa/callback \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. **Firewall blocking Safaricom**
   - Allow incoming POST requests to callback URL
   - Check firewall rules:
     ```bash
     sudo ufw status
     ```

3. **Callback URL misconfigured**
   - Verify in `.env`:
     ```env
     DARAJA_CALLBACK_URL=https://api.yourdomain.com/api/mpesa/callback
     ```
   - Must be HTTPS
   - Must be publicly accessible

4. **Nginx not allowing POST**
   - Check Nginx config allows POST to `/api/mpesa/callback`

---

### Issue: Payment succeeded but no order created

**Symptoms:**
- STK Push completed
- Money deducted from customer
- No order in Shopify Admin

**Causes & Solutions:**

1. **Invalid Shopify token**
   - Verify token in `.env`:
     ```env
     SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
     ```
   - Token may have expired - regenerate in Shopify Admin

2. **Missing API scopes**
   - Token needs `write_orders` scope
   - Regenerate token with correct scopes

3. **Shopify API error**
   - Check backend logs:
     ```bash
     pm2 logs mpesa-api | grep -i shopify
     ```

4. **Product/variant issues**
   - Variant IDs must exist in Shopify
   - Products must be available for sale

---

### Issue: Wrong business name on STK Push

**Symptoms:**
- Customer sees generic or wrong name on phone

**Solutions:**

1. **Sandbox vs Production**
   - Sandbox always shows "SAFARICOM" or similar
   - Only production shows YOUR business name

2. **Verify shortcode**
   - Confirm `DARAJA_SHORTCODE` matches your registered Till

3. **Daraja portal settings**
   - Business name is configured in Daraja portal
   - Contact Safaricom if incorrect

---

## Backend Issues

### Issue: Server won't start

**Symptoms:**
- `npm start` fails
- PM2 shows "errored" status

**Solutions:**

1. **Missing dependencies**
   ```bash
   npm install
   ```

2. **Missing .env file**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Invalid environment variables**
   - Check all required variables are set
   - No spaces around `=` signs

4. **Port already in use**
   ```bash
   # Find process using port 3000
   lsof -i :3000
   # Kill it
   kill -9 <PID>
   ```

5. **Check error details**
   ```bash
   node app.js  # Run directly to see errors
   ```

---

### Issue: PM2 keeps restarting

**Symptoms:**
- PM2 status shows high restart count
- Server keeps crashing

**Solutions:**

1. **Check logs for error**
   ```bash
   pm2 logs mpesa-api --err --lines 100
   ```

2. **Memory issues**
   ```bash
   # Monitor memory
   pm2 monit

   # Increase memory limit
   pm2 start app.js --name mpesa-api --max-memory-restart 200M
   ```

3. **Unhandled promise rejections**
   - Check for async/await error handling in code

---

### Issue: SSL certificate problems

**Symptoms:**
- Browser shows "Not Secure"
- Callbacks fail

**Solutions:**

1. **Renew certificate**
   ```bash
   sudo certbot renew
   ```

2. **Install new certificate**
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

3. **Check certificate status**
   ```bash
   sudo certbot certificates
   ```

---

## Debugging Tips

### View Real-time Logs

```bash
# All logs
pm2 logs mpesa-api

# Error logs only
pm2 logs mpesa-api --err

# Last 200 lines
pm2 logs mpesa-api --lines 200
```

### Test STK Push Manually

```bash
curl -X POST https://api.yourdomain.com/api/mpesa/stkpush \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254712345678",
    "email": "test@test.com",
    "shipping": {
      "fullName": "Test User",
      "address": "Test Address",
      "city": "Nairobi",
      "county": "Nairobi",
      "notes": ""
    },
    "cartItems": [
      {"variant_id": 1, "quantity": 1, "title": "Test", "price": 10}
    ],
    "amount": 10
  }'
```

### Simulate Callback

```bash
curl -X POST https://api.yourdomain.com/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test-123",
        "CheckoutRequestID": "ws_CO_test",
        "ResultCode": 0,
        "ResultDesc": "Success",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 10},
            {"Name": "MpesaReceiptNumber", "Value": "TEST123"},
            {"Name": "TransactionDate", "Value": 20240101120000},
            {"Name": "PhoneNumber", "Value": 254712345678}
          ]
        }
      }
    }
  }'
```

### Check Daraja API Status

```bash
# Test OAuth token generation
curl -X GET "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
  -H "Authorization: Basic $(echo -n 'YOUR_KEY:YOUR_SECRET' | base64)"
```

---

## Getting Help

### Daraja API Support
- Portal: [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
- Documentation: [Daraja API Docs](https://developer.safaricom.co.ke/APIs)

### Shopify Support
- API Docs: [shopify.dev](https://shopify.dev/docs/admin-api)
- Help Center: [help.shopify.com](https://help.shopify.com)

### Log Collection for Support

When reporting issues, collect:

```bash
# System info
uname -a
node --version
npm --version

# PM2 status
pm2 status

# Recent logs (sanitize sensitive data!)
pm2 logs mpesa-api --lines 500 > logs.txt

# Environment (remove secrets!)
cat .env | grep -v KEY | grep -v SECRET | grep -v TOKEN
```
