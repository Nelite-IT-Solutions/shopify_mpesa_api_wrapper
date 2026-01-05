# M-Pesa Integration Documentation

This folder contains all documentation for the M-Pesa (Daraja API) integration with the Shopify store.

## Documentation Index

| Document | Description |
|----------|-------------|
| [MPESA_INTEGRATION.md](./MPESA_INTEGRATION.md) | Complete design document and architecture overview |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Step-by-step deployment guide for backend and theme |
| [API.md](./API.md) | Backend API endpoints documentation |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |
| [CONFIGURATION.md](./CONFIGURATION.md) | Environment variables and configuration reference |

## Quick Start

1. **Read the Design** - Start with [MPESA_INTEGRATION.md](./MPESA_INTEGRATION.md) to understand the architecture
2. **Set Up Shopify App** - Create a Private App in Shopify Admin (instructions in design doc)
3. **Deploy Backend** - Follow [DEPLOYMENT.md](./DEPLOYMENT.md) to deploy to your VPS
4. **Configure** - Set up environment variables per [CONFIGURATION.md](./CONFIGURATION.md)
5. **Test** - Use sandbox mode first, then production

## Project Structure

```
khoiscollections-co-ke-trade/
├── docs/                          # Documentation (you are here)
│   ├── README.md                  # This file
│   ├── MPESA_INTEGRATION.md       # Design & architecture
│   ├── DEPLOYMENT.md              # Deployment guide
│   ├── API.md                     # API documentation
│   ├── TROUBLESHOOTING.md         # Common issues
│   └── CONFIGURATION.md           # Config reference
│
├── mpesa-backend/                 # Node.js backend (deploy to VPS)
│   ├── app.js                     # Express entry point
│   ├── package.json               # Dependencies
│   ├── .env.example               # Environment template
│   ├── routes/
│   │   └── mpesa.js               # API routes
│   ├── services/
│   │   ├── daraja.js              # Daraja API integration
│   │   └── shopify.js             # Shopify Admin API
│   └── utils/
│       └── validators.js          # Validation utilities
│
├── assets/                        # Shopify theme assets
│   ├── mpesa-payment.js           # Frontend payment logic
│   └── mpesa-payment.css          # Payment form/modal styles
│
├── snippets/                      # Shopify Liquid snippets
│   ├── mpesa-checkout-form.liquid # Shipping form + pay button
│   ├── mpesa-payment-modal.liquid # Payment status modal
│   └── kenya-counties.liquid      # Counties dropdown options
│
└── sections/
    └── main-cart-footer.liquid    # Modified to include M-Pesa
```

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Shopify Store  │────▶│  Your Backend    │────▶│  Daraja API     │
│  (Theme Files)  │     │  (Node.js/VPS)   │     │  (Safaricom)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Shopify Admin   │
                        │  (Order Creation)│
                        └──────────────────┘
```

## Key Features

- **Direct M-Pesa Payments** - Money goes directly to your Till number
- **Branded STK Push** - Your business name appears on customer's phone
- **No Third-Party Fees** - Only standard Safaricom charges
- **Automatic Order Creation** - Orders created in Shopify with payment details
- **Pre-Checkout Flow** - Shipping info collected on cart page

## Support

For issues with:
- **Daraja API** - Check [Safaricom Developer Portal](https://developer.safaricom.co.ke)
- **Shopify API** - Check [Shopify Admin API Docs](https://shopify.dev/docs/admin-api)
- **This Integration** - See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
