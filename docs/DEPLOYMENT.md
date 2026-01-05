# Deployment Guide

Complete step-by-step guide for deploying the M-Pesa integration.

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ installed on your VPS
- [ ] Nginx installed on your VPS
- [ ] Domain/subdomain for your API (e.g., `api.yourdomain.com`)
- [ ] SSL certificate capability (Let's Encrypt/Certbot)
- [ ] Daraja API credentials from [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
- [ ] Shopify store admin access

---

## Part 1: Create Shopify Private App

You need a Shopify access token to create orders via Admin API.

### Step 1.1: Access App Development

1. Go to your Shopify Admin: `https://admin.shopify.com/store/khoiscollections-co-ke-trade`
2. Click **Settings** (bottom left corner)
3. Click **Apps and sales channels**
4. Click **Develop apps** (top right)
5. If prompted, click **Allow custom app development**

### Step 1.2: Create the App

1. Click **Create an app**
2. Enter app name: `M-Pesa Integration`
3. Select yourself as App developer
4. Click **Create app**

### Step 1.3: Configure API Scopes

1. Click **Configure Admin API scopes**
2. Enable these scopes:
   - `write_orders` - Create orders
   - `read_orders` - Read order details
   - `write_customers` - Create customers
   - `read_customers` - Read customer info
   - `read_products` - Access product data
   - `read_inventory` - Check stock levels
3. Click **Save**

### Step 1.4: Install and Get Token

1. Click **Install app**
2. Review permissions and click **Install**
3. Go to **API credentials** tab
4. Under **Admin API access token**, click **Reveal token once**
5. **COPY THIS IMMEDIATELY** - It's only shown once!
6. Save it securely (you'll need it for `.env` file)

The token format: `shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Part 2: Deploy Backend to VPS

### Step 2.1: Upload Files

From your local machine, upload the backend files:

```bash
# Option 1: Using SCP
scp -r mpesa-backend/ user@your-vps-ip:/var/www/mpesa-api/

# Option 2: Using rsync (recommended)
rsync -avz mpesa-backend/ user@your-vps-ip:/var/www/mpesa-api/

# Option 3: Using Git
# Push to a Git repo, then clone on VPS
git clone https://github.com/your-repo/mpesa-backend.git /var/www/mpesa-api
```

### Step 2.2: Install Dependencies

SSH into your VPS and install dependencies:

```bash
# Connect to VPS
ssh user@your-vps-ip

# Navigate to project
cd /var/www/mpesa-api

# Install dependencies
npm install
```

### Step 2.3: Configure Environment

Create and configure the environment file:

```bash
# Copy template
cp .env.example .env

# Edit with your credentials
nano .env
```

Fill in your values:

```env
# ===========================================
# DARAJA API CONFIGURATION
# ===========================================
DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here
DARAJA_SHORTCODE=your_till_number
DARAJA_PASSKEY=your_passkey_from_safaricom
DARAJA_CALLBACK_URL=https://api.yourdomain.com/api/mpesa/callback
DARAJA_ENV=sandbox

# ===========================================
# SHOPIFY CONFIGURATION
# ===========================================
SHOPIFY_STORE_DOMAIN=khoiscollections-co-ke-trade.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_token_here

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://khoiscollections.co.ke,https://khoiscollections-co-ke-trade.myshopify.com
```

### Step 2.4: Test the Server

Start the server to verify it works:

```bash
# Start server
npm start

# Expected output:
# M-Pesa Backend API running on port 3000
# Environment: production
```

Press `Ctrl+C` to stop after testing.

### Step 2.5: Set Up PM2 Process Manager

PM2 keeps your server running and restarts it if it crashes:

```bash
# Install PM2 globally
npm install -g pm2

# Start the app with PM2
pm2 start app.js --name "mpesa-api"

# Save PM2 configuration
pm2 save

# Set up auto-start on system boot
pm2 startup

# Run the command PM2 outputs (looks like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser
```

Verify it's running:

```bash
pm2 status

# Should show:
# ┌─────┬────────────┬─────────────┬─────────┬─────────┬──────────┐
# │ id  │ name       │ namespace   │ version │ mode    │ pid      │
# ├─────┼────────────┼─────────────┼─────────┼─────────┼──────────┤
# │ 0   │ mpesa-api  │ default     │ 1.0.0   │ fork    │ 12345    │
# └─────┴────────────┴─────────────┴─────────┴─────────┴──────────┘
```

### Step 2.6: Configure Nginx Reverse Proxy

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/mpesa-api
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Replace with your domain

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

        # Increase timeout for long-polling
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
    }
}
```

Enable the site:

```bash
# Create symlink to enable site
sudo ln -s /etc/nginx/sites-available/mpesa-api /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### Step 2.7: Install SSL Certificate

Daraja API requires HTTPS for callbacks:

```bash
# Install Certbot if not already installed
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

Certbot auto-renews certificates. Verify auto-renewal:

```bash
sudo certbot renew --dry-run
```

### Step 2.8: Verify Backend Deployment

Test your API:

```bash
# Test health endpoint
curl https://api.yourdomain.com/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

---

## Part 3: Deploy Theme Files to Shopify

### Option A: Upload via Shopify Admin (Recommended for beginners)

1. Go to **Shopify Admin** → **Online Store** → **Themes**
2. Find your active theme, click **Actions** → **Edit code**

**Upload Snippets:**
1. In the left sidebar, find **Snippets**
2. Click **Add a new snippet**
3. Create and paste content for:
   - `mpesa-checkout-form` (from `snippets/mpesa-checkout-form.liquid`)
   - `mpesa-payment-modal` (from `snippets/mpesa-payment-modal.liquid`)
   - `kenya-counties` (from `snippets/kenya-counties.liquid`)

**Upload Assets:**
1. In the left sidebar, find **Assets**
2. Click **Add a new asset** → **Create a blank file**
3. Create and paste content for:
   - `mpesa-payment.js` (from `assets/mpesa-payment.js`)
   - `mpesa-payment.css` (from `assets/mpesa-payment.css`)

**Update Section:**
1. In the left sidebar, find **Sections**
2. Find `main-cart-footer.liquid`
3. Replace with the modified version

### Option B: Upload via Shopify CLI (Faster for developers)

```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Login to Shopify
shopify auth login --store khoiscollections-co-ke-trade.myshopify.com

# Push specific files
shopify theme push --path . --only \
  snippets/mpesa-checkout-form.liquid \
  snippets/mpesa-payment-modal.liquid \
  snippets/kenya-counties.liquid \
  assets/mpesa-payment.js \
  assets/mpesa-payment.css \
  sections/main-cart-footer.liquid
```

### Step 3.1: Update Frontend Configuration

**CRITICAL:** Update the backend URL in `assets/mpesa-payment.js`:

1. Open `assets/mpesa-payment.js` in Shopify code editor
2. Find line 14:
   ```javascript
   const MPESA_API_URL = 'https://your-backend-domain.com/api/mpesa';
   ```
3. Replace with your actual backend URL:
   ```javascript
   const MPESA_API_URL = 'https://api.yourdomain.com/api/mpesa';
   ```
4. Click **Save**

---

## Part 4: Testing

### Phase 1: Sandbox Testing

1. Ensure `.env` has `DARAJA_ENV=sandbox`
2. Use Daraja sandbox credentials
3. Test phone: `254708374149` (or your registered test number)

**Test the flow:**
1. Add items to cart on your store
2. Fill shipping information
3. Click "Pay with M-Pesa"
4. Confirm phone number
5. Check test phone for STK Push
6. Enter M-Pesa PIN
7. Verify order in Shopify Admin

### Phase 2: Production Testing

1. Update `.env` to `DARAJA_ENV=production`
2. Use production Daraja credentials
3. Restart server: `pm2 restart mpesa-api`
4. Test with real phone (small amount like KES 10)
5. Verify:
   - STK Push shows YOUR business name
   - Money arrives in your Till
   - Order created in Shopify

---

## Production Checklist

Before going live:

- [ ] Backend deployed and running with PM2
- [ ] SSL certificate installed (HTTPS required)
- [ ] Production Daraja credentials configured
- [ ] `DARAJA_ENV=production` in `.env`
- [ ] Shopify access token configured
- [ ] CORS origins include your domain(s)
- [ ] Theme files uploaded to Shopify
- [ ] `MPESA_API_URL` updated in `mpesa-payment.js`
- [ ] Test payment successful
- [ ] Order created with correct details
- [ ] Money received in M-Pesa Till

---

## Post-Deployment

### Monitoring

```bash
# View PM2 status
pm2 status

# View real-time logs
pm2 logs mpesa-api

# Monitor resources
pm2 monit
```

### Updating the Backend

```bash
# SSH to VPS
ssh user@your-vps-ip

# Navigate to project
cd /var/www/mpesa-api

# Pull updates (if using Git)
git pull

# Or upload new files

# Install any new dependencies
npm install

# Restart server
pm2 restart mpesa-api
```

### Updating Theme Files

Use Shopify Admin code editor or Shopify CLI to update theme files as needed.
