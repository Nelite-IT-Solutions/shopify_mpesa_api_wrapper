# M-Pesa (Daraja API) Integration for Shopify

> **Related Documentation:**
> - [DEPLOYMENT.md](./DEPLOYMENT.md) - Step-by-step deployment guide
> - [API.md](./API.md) - Backend API reference
> - [CONFIGURATION.md](./CONFIGURATION.md) - Environment variables reference
> - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions

---

## Overview

This document outlines the design and implementation plan for integrating Safaricom's Daraja API (M-Pesa) directly into the Shopify store, bypassing third-party payment aggregators.

### Problem Statement

Third-party M-Pesa apps (IntaSend, Pesapal, etc.) have limitations:
- **Funds Collection**: They collect money on behalf of the business, adding friction to access funds
- **No Branding**: STK Push shows the aggregator's name, not your business name
- **Transaction Fees**: Additional charges per transaction

### Solution

A custom integration where:
- **Direct Payment**: Money goes directly to YOUR M-Pesa Till/Paybill
- **Branded STK Push**: Your business name appears on customer's phone
- **Zero Third-Party Fees**: Only standard Safaricom charges apply
- **Full Control**: You own the entire payment flow

---

## Architecture

### Revised Flow: Pre-Checkout with Shipping Collection

Since Shopify's checkout page cannot be modified, we collect shipping information directly on the cart page before payment. This provides a complete checkout-like experience.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER JOURNEY                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. Customer shops on Shopify → Adds items to cart                      │
│                           │                                              │
│                           ▼                                              │
│   2. Cart Page displays:                                                 │
│      ┌─────────────────────────────────────────────────┐                │
│      │  [Cart Items Summary]                           │                │
│      │                                                 │                │
│      │  ── Shipping Information ──                     │                │
│      │  Full Name: [____________]                      │                │
│      │  Phone:     [____________]                      │                │
│      │  Address:   [____________]                      │                │
│      │  City:      [____________]                      │                │
│      │  County:    [____________]  (Dropdown)          │                │
│      │                                                 │                │
│      │  [  💳 Checkout (Cards/Other)  ]  ← Standard    │                │
│      │  [  📱 Pay with M-Pesa  ]        ← NEW         │                │
│      └─────────────────────────────────────────────────┘                │
│                           │                                              │
│                           ▼                                              │
│   3. Customer fills shipping info → Clicks "Pay with M-Pesa"            │
│                           │                                              │
│                           ▼                                              │
│   4. Modal confirms M-Pesa phone number (pre-filled from shipping)      │
│      "We'll send payment request to 0712XXXXXX"                         │
│      [ Confirm & Pay ]                                                   │
│                           │                                              │
│                           ▼                                              │
│   5. Frontend sends to YOUR backend:                                     │
│      - Cart items + totals                                              │
│      - Shipping address                                                  │
│      - M-Pesa phone number                                              │
│                           │                                              │
└───────────────────────────┼──────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         YOUR BACKEND (VPS)                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   5. Backend receives: cart items, total amount, phone number           │
│                           │                                              │
│                           ▼                                              │
│   6. Backend calls Daraja API → STK Push initiated                      │
│      (Using YOUR Consumer Key, Secret, Shortcode, Passkey)              │
│                           │                                              │
│                           ▼                                              │
│   7. Customer receives STK Push on phone                                │
│      "Pay KES X,XXX to [YOUR BUSINESS NAME]"                           │
│                           │                                              │
│                           ▼                                              │
│   8. Customer enters M-Pesa PIN → Payment processed                     │
│                           │                                              │
│                           ▼                                              │
│   9. Safaricom sends callback to YOUR backend                           │
│      (Success/Failure notification)                                      │
│                           │                                              │
│                           ▼                                              │
│   10. On SUCCESS:                                                        │
│       - Backend creates Shopify Order via Admin API                     │
│       - Order marked as "Paid"                                          │
│       - Customer cart cleared                                           │
│       - Confirmation shown to customer                                  │
│                                                                          │
│   11. On FAILURE:                                                        │
│       - Error message shown to customer                                 │
│       - Customer can retry                                              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        SHOPIFY ADMIN                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Order appears with:                                                    │
│   - Payment Status: Paid                                                │
│   - Payment Method: M-Pesa                                              │
│   - M-Pesa Receipt Number: [XXXXX]                                      │
│   - Customer Details                                                     │
│   - Line Items                                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Backend API (Node.js/Express) - On Your VPS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mpesa/stkpush` | POST | Initiates STK Push to customer's phone |
| `/api/mpesa/callback` | POST | Receives payment confirmation from Safaricom |
| `/api/mpesa/status/:id` | GET | Polls payment status (for frontend) |

**Responsibilities:**
- Generate Daraja OAuth access token
- Initiate STK Push with your business shortcode
- Handle Safaricom callback (payment success/failure)
- Create Shopify order via Admin API
- Store transaction state temporarily (in-memory or Redis)

### 2. Shopify Theme Modifications

| File | Purpose |
|------|---------|
| `snippets/mpesa-checkout-form.liquid` | Shipping form + M-Pesa button |
| `snippets/mpesa-payment-modal.liquid` | Payment confirmation modal |
| `assets/mpesa-payment.js` | Payment flow logic, form validation |
| `assets/mpesa-payment.css` | Styling for form and modal |
| `sections/main-cart-footer.liquid` | Include M-Pesa checkout section |

**Revised User Flow:**
1. Customer on cart page sees shipping form + "Pay with M-Pesa" button
2. Customer fills shipping details (name, phone, address, city, county)
3. Clicks "Pay with M-Pesa" button
4. Modal shows: "We'll send payment request to 07XXXXXXXX. Confirm?"
5. Customer confirms → STK Push sent to phone
6. Modal shows "Waiting for payment..." with animated loader
7. Customer enters M-Pesa PIN on their phone
8. On success:
   - Order created in Shopify (marked as Paid)
   - Modal shows "Payment successful! Redirecting..."
   - Customer redirected to **Shopify Order Status Page**
   - Cart automatically cleared
9. On failure: Error message with retry option

**Order Confirmation (Shopify Order Status Page):**
After successful payment, customer sees Shopify's native order status page showing:
- Order number (e.g., #1001)
- Items purchased with images
- Shipping address
- Payment status: "Paid via M-Pesa"
- M-Pesa receipt number in order notes
- Future: Tracking information when fulfilled

**Shipping Form Fields:**
- Full Name (required)
- Phone Number (required, used for M-Pesa)
- Email (optional, for order confirmation)
- Street Address (required)
- City/Town (required)
- County (dropdown, required)
- Additional Notes (optional)

### 3. Shopify Admin Configuration

- **Manual Payment Method**: Add "M-Pesa" as a manual payment option (fallback)
- **Private App / Access Token**: For creating orders via Admin API

---

## Data Flow Diagram

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐
│Customer │    │ Shopify  │    │  Your   │    │  Daraja  │    │ Shopify │
│ Browser │    │  Theme   │    │ Backend │    │   API    │    │Admin API│
└────┬────┘    └────┬─────┘    └────┬────┘    └────┬─────┘    └────┬────┘
     │              │               │              │               │
     │ Add to Cart  │               │              │               │
     │─────────────>│               │              │               │
     │              │               │              │               │
     │ Click M-Pesa │               │              │               │
     │─────────────>│               │              │               │
     │              │               │              │               │
     │ Enter Phone  │               │              │               │
     │─────────────>│               │              │               │
     │              │               │              │               │
     │              │ POST /stkpush │              │               │
     │              │──────────────>│              │               │
     │              │               │              │               │
     │              │               │ STK Push     │               │
     │              │               │─────────────>│               │
     │              │               │              │               │
     │              │               │ Request ID   │               │
     │              │               │<─────────────│               │
     │              │               │              │               │
     │              │ Checkout ID   │              │               │
     │              │<──────────────│              │               │
     │              │               │              │               │
     │ STK Push Prompt (on phone)   │              │               │
     │<─────────────────────────────────────────────               │
     │              │               │              │               │
     │ Enter PIN    │               │              │               │
     │─────────────────────────────────────────────>               │
     │              │               │              │               │
     │              │               │ Callback     │               │
     │              │               │<─────────────│               │
     │              │               │              │               │
     │              │               │ Create Order │               │
     │              │               │─────────────────────────────>│
     │              │               │              │               │
     │              │               │ Order Created│               │
     │              │               │<─────────────────────────────│
     │              │               │              │               │
     │              │ Poll Status   │              │               │
     │              │──────────────>│              │               │
     │              │               │              │               │
     │              │ Payment Done  │              │               │
     │              │<──────────────│              │               │
     │              │               │              │               │
     │ Show Success │               │              │               │
     │<─────────────│               │              │               │
     │              │               │              │               │
```

---

## Prerequisites

### 1. Daraja API Credentials (You Already Have)
- Consumer Key
- Consumer Secret
- Shortcode (Till Number or Paybill)
- Passkey (from Safaricom)
- Callback URL (must be HTTPS, publicly accessible)

### 2. Shopify Private App / Access Token
Create via: Shopify Admin → Settings → Apps and sales channels → Develop apps

**Required Scopes:**
- `write_orders` - Create orders
- `read_products` - Access product details
- `write_customers` - Create/update customer records

### 3. Your VPS Requirements
- Node.js 18+ installed
- HTTPS enabled (for Daraja callbacks)
- Express.js (or add to existing app)
- Internet access to Safaricom APIs

---

## Step-by-Step: Create Shopify Private App

Since you need Admin API access to create orders, follow these steps:

### 1. Go to Shopify Admin
Navigate to: `https://admin.shopify.com/store/khoiscollections-co-ke-trade`

### 2. Access App Development
1. Click **Settings** (bottom left)
2. Click **Apps and sales channels**
3. Click **Develop apps** (top right)
4. Click **Allow custom app development** (if prompted)

### 3. Create the App
1. Click **Create an app**
2. App name: `M-Pesa Integration`
3. App developer: Select yourself
4. Click **Create app**

### 4. Configure API Scopes
1. Click **Configure Admin API scopes**
2. Enable these scopes:
   - ✅ `write_orders` - Create orders
   - ✅ `read_orders` - Read order details
   - ✅ `write_customers` - Create customers
   - ✅ `read_customers` - Read customer info
   - ✅ `read_products` - Access product data
   - ✅ `read_inventory` - Check stock levels
3. Click **Save**

### 5. Install the App
1. Click **Install app**
2. Review permissions and click **Install**

### 6. Get Your Access Token
1. Go to **API credentials** tab
2. Under **Admin API access token**, click **Reveal token once**
3. ⚠️ **COPY THIS IMMEDIATELY** - It's only shown once!
4. Save it securely (you'll add it to your backend .env file)

The token looks like: `shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Configuration

### Environment Variables (Backend)

```env
# ===========================================
# DARAJA API CONFIGURATION (Till Number / Buy Goods)
# ===========================================
DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here
DARAJA_SHORTCODE=your_till_number          # e.g., 174379 (sandbox) or your actual till
DARAJA_PASSKEY=your_passkey_from_safaricom
DARAJA_CALLBACK_URL=https://your-vps-domain.com/api/mpesa/callback
DARAJA_TRANSACTION_TYPE=CustomerBuyGoodsOnline  # For Till Number
DARAJA_ENV=sandbox                          # Change to 'production' when ready

# Daraja API URLs (auto-selected based on DARAJA_ENV)
# Sandbox: https://sandbox.safaricom.co.ke
# Production: https://api.safaricom.co.ke

# ===========================================
# SHOPIFY CONFIGURATION
# ===========================================
SHOPIFY_STORE_DOMAIN=khoiscollections-co-ke-trade.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxx  # From Private App setup

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3000
NODE_ENV=development
CORS_ORIGINS=https://khoiscollections.co.ke,https://khoiscollections-co-ke-trade.myshopify.com

# ===========================================
# OPTIONAL: LOGGING & MONITORING
# ===========================================
LOG_LEVEL=info
```

### Note on Till Number vs Paybill

Since you're using a **Till Number (Buy Goods)**:
- `DARAJA_TRANSACTION_TYPE` = `CustomerBuyGoodsOnline`
- No Account Number needed (unlike Paybill)
- Customer sees: "Pay to [Your Business Name] Till [Number]"

### Shopify Theme Settings

The M-Pesa button will need your backend URL configured:

```javascript
// In assets/mpesa-payment.js
const MPESA_API_URL = 'https://your-vps-domain.com/api/mpesa';
```

---

## Security Considerations

### 1. CORS Protection
- Backend only accepts requests from your Shopify store domain
- Callback endpoint validates Safaricom's IP ranges

### 2. Request Validation
- Verify cart total matches on backend (prevent tampering)
- Validate phone number format (254XXXXXXXXX)
- Rate limiting to prevent abuse

### 3. Callback Verification
- Validate callback signature/origin
- Store transaction IDs to prevent replay attacks

### 4. HTTPS Required
- All endpoints must use HTTPS
- Daraja API requires HTTPS callback URL

---

## File Structure

```
your-vps-project/
├── routes/
│   └── mpesa.js              # M-Pesa API routes
├── services/
│   ├── daraja.js             # Daraja API integration (STK Push)
│   └── shopify.js            # Shopify Admin API (Order creation)
├── utils/
│   └── validators.js         # Phone number, amount validation
├── .env                      # Environment variables
└── app.js                    # Express app entry point

shopify-theme/ (this project)
├── assets/
│   ├── mpesa-payment.js      # Frontend payment logic, form validation
│   └── mpesa-payment.css     # Form and modal styling
├── snippets/
│   ├── mpesa-checkout-form.liquid   # Shipping form + M-Pesa button
│   ├── mpesa-payment-modal.liquid   # Confirmation/waiting modal
│   └── kenya-counties.liquid        # Kenya counties dropdown options
└── sections/
    └── main-cart-footer.liquid      # Modified to include M-Pesa section
```

### Kenya Counties List
The shipping form will include a dropdown with all 47 Kenyan counties for accurate delivery information.

---

## Implementation Timeline

| Task | Estimated Time |
|------|----------------|
| Backend API setup | 3-4 hours |
| Daraja integration (STK Push + Callback) | 2-3 hours |
| Shopify Admin API integration | 1-2 hours |
| Theme modifications | 2-3 hours |
| Testing (Sandbox) | 2-3 hours |
| Production deployment | 1-2 hours |
| **Total** | **11-17 hours (1.5-2 days)** |

---

## Testing Strategy

### Phase 1: Sandbox Testing
1. Use Daraja sandbox credentials
2. Test with sandbox phone numbers
3. Verify callback handling
4. Confirm Shopify order creation

### Phase 2: Production Testing
1. Switch to production credentials
2. Test with real phone number (small amount)
3. Verify money arrives in Till/Paybill
4. Confirm full order flow

---

## Limitations & Considerations

### What This Solution Does:
- Direct M-Pesa payments to YOUR account
- Branded STK Push with YOUR business name
- Automatic order creation in Shopify
- Real-time payment status updates

### What This Solution Does NOT Do:
- Replace Shopify's native checkout (we add alongside it)
- Handle refunds automatically (manual process via M-Pesa)
- Support recurring payments (single transactions only)
- Work with Shopify's standard checkout flow

### Customer Experience Note:
- Customers click "Pay with M-Pesa" instead of "Checkout"
- They complete payment before traditional checkout
- Order is created directly (no Shopify checkout page)

---

## Next Steps

1. **Confirm this design meets your requirements**
2. **Provide/confirm the following:**
   - Your VPS domain/IP for CORS configuration
   - Confirm Node.js version on your VPS
   - Confirm you have Shopify private app access token (or I'll guide you to create one)
3. **I will then implement:**
   - Complete backend code
   - Shopify theme modifications
   - Deployment instructions

---

## Summary of Design Decisions

| Decision | Choice Made |
|----------|-------------|
| Backend hosting | Your existing VPS (Node.js/Express) |
| Payment type | Till Number (Buy Goods) |
| Shipping collection | On cart page (Pre-checkout flow) |
| Customer flow | Fill shipping → Confirm phone → Pay → Order created |
| Normal checkout | Still available for other payment methods |

---

## Ready to Implement?

Once you confirm this design:
1. I will create the **backend API code** (Node.js/Express)
2. I will create the **Shopify theme modifications**
3. I will provide **deployment instructions**

**Before I start, please:**
1. ✅ Create the Shopify Private App (follow instructions above)
2. ✅ Have your Daraja API credentials ready
3. ✅ Confirm your VPS domain/IP for CORS configuration

---

## Estimated Deliverables

| Component | Files |
|-----------|-------|
| Backend API | `routes/mpesa.js`, `services/daraja.js`, `services/shopify.js` |
| Theme Files | `mpesa-checkout-form.liquid`, `mpesa-payment-modal.liquid`, `mpesa-payment.js`, `mpesa-payment.css` |
| Config | `.env.example`, setup instructions |

---

## Deployment Instructions

### Step 1: Deploy Backend to Your VPS

#### 1.1 Copy Backend Files

Upload the `mpesa-backend/` directory to your VPS:

```bash
# From your local machine
scp -r mpesa-backend/ user@your-vps-ip:/var/www/mpesa-api/

# Or using rsync
rsync -avz mpesa-backend/ user@your-vps-ip:/var/www/mpesa-api/
```

#### 1.2 Install Dependencies

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Navigate to the directory
cd /var/www/mpesa-api

# Install Node.js dependencies
npm install
```

#### 1.3 Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit with your actual credentials
nano .env
```

Fill in your actual values:
```env
# Daraja API (Get from https://developer.safaricom.co.ke)
DARAJA_CONSUMER_KEY=your_actual_consumer_key
DARAJA_CONSUMER_SECRET=your_actual_consumer_secret
DARAJA_SHORTCODE=your_till_number
DARAJA_PASSKEY=your_passkey
DARAJA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback
DARAJA_ENV=sandbox  # Change to 'production' when ready

# Shopify (Get from Shopify Admin → Apps → Develop apps)
SHOPIFY_STORE_DOMAIN=khoiscollections-co-ke-trade.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_actual_token

# Server
PORT=3000
CORS_ORIGINS=https://khoiscollections.co.ke,https://khoiscollections-co-ke-trade.myshopify.com
```

#### 1.4 Test Locally First

```bash
# Start the server
npm start

# You should see:
# M-Pesa Backend API running on port 3000
# Environment: development
```

#### 1.5 Set Up Process Manager (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Start the app with PM2
pm2 start app.js --name "mpesa-api"

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

#### 1.6 Configure Nginx Reverse Proxy

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/mpesa-api
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-api-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and get SSL:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/mpesa-api /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Install SSL certificate (required for Daraja callback)
sudo certbot --nginx -d your-api-domain.com
```

### Step 2: Deploy Theme Files to Shopify

#### 2.1 Option A: Upload via Shopify Admin

1. Go to **Shopify Admin** → **Online Store** → **Themes**
2. Click **Actions** → **Edit code**
3. Upload each file to the correct directory:

| File | Upload to |
|------|-----------|
| `snippets/mpesa-checkout-form.liquid` | snippets/ |
| `snippets/mpesa-payment-modal.liquid` | snippets/ |
| `snippets/kenya-counties.liquid` | snippets/ |
| `assets/mpesa-payment.js` | assets/ |
| `assets/mpesa-payment.css` | assets/ |

4. Find `sections/main-cart-footer.liquid` and replace with the modified version

#### 2.2 Option B: Use Shopify CLI

```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Login to Shopify
shopify auth login --store khoiscollections-co-ke-trade.myshopify.com

# Push theme files
shopify theme push --path . --only snippets/mpesa-checkout-form.liquid snippets/mpesa-payment-modal.liquid snippets/kenya-counties.liquid assets/mpesa-payment.js assets/mpesa-payment.css sections/main-cart-footer.liquid
```

### Step 3: Update Frontend Configuration

**IMPORTANT:** Update the backend URL in `assets/mpesa-payment.js`:

```javascript
// Line 14 in mpesa-payment.js
const MPESA_API_URL = 'https://your-api-domain.com/api/mpesa';
```

Replace `your-api-domain.com` with your actual backend domain.

---

## Testing Instructions

### Phase 1: Backend Health Check

```bash
# Test if backend is running
curl https://your-api-domain.com/health

# Expected response:
# {"status":"ok","timestamp":"..."}
```

### Phase 2: Sandbox Testing

#### 2.1 Configure Sandbox Mode

Ensure your `.env` has:
```env
DARAJA_ENV=sandbox
```

#### 2.2 Daraja Sandbox Test Credentials

Use these sandbox credentials from Safaricom:
- **Shortcode (Till):** `174379`
- **Passkey:** Get from your Daraja dashboard (sandbox)
- **Test Phone:** `254708374149` (or your registered test number)

#### 2.3 Test the Payment Flow

1. Add items to cart on your Shopify store
2. Fill in shipping information
3. Click "Pay with M-Pesa"
4. Confirm the phone number in the modal
5. Check your test phone for STK Push prompt
6. Enter M-Pesa PIN
7. Verify order created in Shopify Admin

#### 2.4 Test STK Push Directly

```bash
# Test STK Push endpoint
curl -X POST https://your-api-domain.com/api/mpesa/stkpush \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254708374149",
    "email": "test@example.com",
    "shipping": {
      "fullName": "Test User",
      "address": "123 Test Street",
      "city": "Nairobi",
      "county": "Nairobi",
      "notes": ""
    },
    "cartItems": [
      {
        "variant_id": 12345678,
        "quantity": 1,
        "title": "Test Product",
        "price": 100
      }
    ],
    "amount": 100
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Payment request sent. Please check your phone.",
  "checkoutRequestId": "ws_CO_xxxxxxxxxxxx"
}
```

#### 2.5 Check Payment Status

```bash
curl https://your-api-domain.com/api/mpesa/status/ws_CO_xxxxxxxxxxxx
```

### Phase 3: Production Testing

#### 3.1 Switch to Production

Update `.env`:
```env
DARAJA_ENV=production
DARAJA_SHORTCODE=your_actual_till_number
DARAJA_PASSKEY=your_actual_passkey
DARAJA_CONSUMER_KEY=your_production_key
DARAJA_CONSUMER_SECRET=your_production_secret
```

Restart the server:
```bash
pm2 restart mpesa-api
```

#### 3.2 Test with Real Money

1. Use a small amount (e.g., KES 10)
2. Complete a test purchase with your own phone
3. Verify:
   - STK Push shows YOUR business name
   - Money arrives in your M-Pesa Till
   - Order appears in Shopify Admin as "Paid"
   - M-Pesa receipt number is in order notes

---

## Troubleshooting

### Common Issues

#### 1. "Unable to connect to payment server"

**Cause:** Frontend can't reach backend
**Solution:**
- Check CORS_ORIGINS includes your Shopify domain
- Verify backend is running: `pm2 status`
- Check Nginx is proxying correctly: `sudo nginx -t`

#### 2. "STK Push not received"

**Cause:** Daraja API issue
**Solution:**
- Check Daraja credentials in `.env`
- Verify callback URL is HTTPS and accessible
- Check phone number format (254XXXXXXXXX)
- Review backend logs: `pm2 logs mpesa-api`

#### 3. "Payment timed out"

**Cause:** Callback not received
**Solution:**
- Verify callback URL is publicly accessible
- Check Nginx/firewall allows POST to callback endpoint
- Review Daraja dashboard for callback delivery status

#### 4. "Order not created in Shopify"

**Cause:** Shopify API issue
**Solution:**
- Verify SHOPIFY_ACCESS_TOKEN is valid
- Check token has `write_orders` scope
- Review backend logs for Shopify API errors

### Viewing Logs

```bash
# View real-time logs
pm2 logs mpesa-api

# View last 100 lines
pm2 logs mpesa-api --lines 100

# View error logs only
pm2 logs mpesa-api --err
```

### Testing Callback Manually

You can simulate a callback for testing:

```bash
curl -X POST https://your-api-domain.com/api/mpesa/callback \
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
            {"Name": "Amount", "Value": 100},
            {"Name": "MpesaReceiptNumber", "Value": "TEST123"},
            {"Name": "TransactionDate", "Value": 20240101120000},
            {"Name": "PhoneNumber", "Value": 254712345678}
          ]
        }
      }
    }
  }'
```

---

## Production Checklist

Before going live, verify:

- [ ] Backend deployed and running with PM2
- [ ] SSL certificate installed (HTTPS required)
- [ ] Production Daraja credentials configured
- [ ] Shopify access token with correct scopes
- [ ] CORS configured for your domain(s)
- [ ] Theme files uploaded to Shopify
- [ ] `MPESA_API_URL` updated in `mpesa-payment.js`
- [ ] Test payment completed successfully
- [ ] Order created in Shopify with correct details
- [ ] Money received in M-Pesa Till

---

## Support & Maintenance

### Monitoring

Set up monitoring for:
- Backend uptime (PM2, UptimeRobot, etc.)
- Error rates in logs
- Transaction success rates

### Updates

Keep dependencies updated:
```bash
cd /var/www/mpesa-api
npm update
pm2 restart mpesa-api
```

### Backup

Regularly backup:
- `.env` configuration file
- PM2 ecosystem file
- Nginx configuration
