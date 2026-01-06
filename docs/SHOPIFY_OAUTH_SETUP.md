# Shopify OAuth Setup Guide

As of January 1, 2026, Shopify requires apps to use OAuth for authentication. This guide explains how to set up your app using the **Client Credentials Grant** flow.

## Overview

The Client Credentials Grant allows your server to obtain access tokens without user interaction. Tokens are valid for **24 hours** and are automatically refreshed by the application.

## Prerequisites

- A Shopify Partners account
- Access to the Shopify Dev Dashboard
- Your store must be owned by your organization

## Step 1: Create an App in Dev Dashboard

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Select your organization
3. Click **Apps** in the sidebar
4. Click **Create app**
5. Choose **Create app manually**
6. Enter app name: `M-Pesa Integration`
7. Click **Create**

## Step 2: Configure API Scopes

1. In your app, go to **Configuration**
2. Under **Access scopes**, add the following:

| Scope | Purpose |
|-------|---------|
| `write_orders` | Create orders after M-Pesa payment |
| `read_orders` | Read order details |
| `write_customers` | Create customer records |
| `read_customers` | Read customer info |
| `read_products` | Access product/variant data |
| `read_inventory` | Check stock availability |

3. Click **Save**

## Step 3: Get Client Credentials

1. Go to **Settings** in your app
2. Find **Client credentials**:
   - **Client ID**: Copy this value
   - **Client secret**: Click to reveal and copy

⚠️ **Important**: The client secret is sensitive. Never expose it in frontend code or commit it to repositories.

## Step 4: Install the App in Your Store

1. In your app, go to **Test your app**
2. Select your store from the dropdown
3. Click **Install app**
4. Review and approve the requested permissions

## Step 5: Configure Environment Variables

Update your `.env` file with the credentials:

```env
# Shopify OAuth Configuration
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=your_client_id_here
SHOPIFY_CLIENT_SECRET=your_client_secret_here
```

## How Token Management Works

The application automatically handles OAuth tokens:

1. **First Request**: Fetches a new access token using client credentials
2. **Token Caching**: Stores the token in memory for reuse
3. **Auto-Refresh**: Refreshes the token 5 minutes before expiry
4. **Error Recovery**: If a 401 error occurs, automatically refreshes and retries

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Your Backend   │         │  Shopify OAuth  │         │  Shopify Admin  │
│                 │         │    Endpoint     │         │      API        │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │  POST /oauth/access_token │                           │
         │  (client_id, secret)      │                           │
         │──────────────────────────>│                           │
         │                           │                           │
         │  { access_token, ...}     │                           │
         │<──────────────────────────│                           │
         │                           │                           │
         │  API Request with token   │                           │
         │───────────────────────────────────────────────────────>
         │                           │                           │
         │  API Response             │                           │
         │<───────────────────────────────────────────────────────
         │                           │                           │
```

## Testing the Integration

After configuration, test that OAuth works:

```bash
# Start your server
npm start

# Check logs for:
# "Fetching new Shopify access token..."
# "Shopify access token obtained, expires in: 86399 seconds"
# "Granted scopes: write_orders,read_orders,..."
```

## Troubleshooting

### "Failed to get Shopify access token"

1. **Check credentials**: Verify `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are correct
2. **Check store domain**: Ensure `SHOPIFY_STORE_DOMAIN` matches your store exactly
3. **App not installed**: Make sure the app is installed in the store

### "invalid_client" error

- The client credentials are incorrect
- Regenerate the client secret in the Dev Dashboard

### "invalid_scope" error

- The requested scopes aren't configured in the app
- Add the required scopes in the Dev Dashboard

### Token expires too quickly

- Tokens are valid for 24 hours
- The app automatically refreshes 5 minutes before expiry
- If issues persist, check system time synchronization

## Security Best Practices

1. **Never commit secrets**: Add `.env` to `.gitignore`
2. **Rotate secrets periodically**: Regenerate client secret if compromised
3. **Use HTTPS**: All API calls must use HTTPS
4. **Monitor access**: Check Shopify Partner Dashboard for API usage

## Migrating from Legacy Private Apps

If you previously used a static access token (`shpat_...`):

1. Create a new app in Dev Dashboard (this guide)
2. Update `.env` with new OAuth credentials:
   ```diff
   - SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
   + SHOPIFY_CLIENT_ID=your_client_id
   + SHOPIFY_CLIENT_SECRET=your_client_secret
   ```
3. Restart the server
4. The new OAuth flow handles token management automatically
