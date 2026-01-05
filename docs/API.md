# Backend API Documentation

Complete reference for the M-Pesa backend API endpoints.

## Base URL

```
Production: https://api.yourdomain.com
Development: http://localhost:3000
```

---

## Endpoints

### Health Check

Check if the server is running.

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### Initiate STK Push

Send M-Pesa payment request to customer's phone.

```
POST /api/mpesa/stkpush
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "phone": "254712345678",
  "email": "customer@example.com",
  "shipping": {
    "fullName": "John Doe",
    "address": "123 Main Street, Apt 4B",
    "city": "Nairobi",
    "county": "Nairobi",
    "notes": "Leave at reception"
  },
  "cartItems": [
    {
      "variant_id": 12345678901234,
      "quantity": 2,
      "title": "Product Name",
      "price": 1500
    }
  ],
  "amount": 3000
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Customer phone (254XXXXXXXXX format) |
| `email` | string | No | Customer email for order confirmation |
| `shipping.fullName` | string | Yes | Customer full name |
| `shipping.address` | string | Yes | Street address |
| `shipping.city` | string | Yes | City/Town |
| `shipping.county` | string | Yes | Kenya county |
| `shipping.notes` | string | No | Delivery instructions |
| `cartItems` | array | Yes | Array of cart items |
| `cartItems[].variant_id` | number | Yes | Shopify variant ID |
| `cartItems[].quantity` | number | Yes | Item quantity |
| `cartItems[].title` | string | Yes | Product title |
| `cartItems[].price` | number | Yes | Price in KES (not cents) |
| `amount` | number | Yes | Total amount in KES |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment request sent. Please check your phone.",
  "checkoutRequestId": "ws_CO_01012024120000123456789"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid phone number format",
  "errors": ["Phone number must be a valid Kenyan number"]
}
```

**Error Response (500):**
```json
{
  "success": false,
  "message": "Failed to initiate payment",
  "errors": ["Daraja API error message"]
}
```

---

### Check Payment Status

Poll for payment status after initiating STK Push.

```
GET /api/mpesa/status/:checkoutRequestId
```

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `checkoutRequestId` | string | The checkout ID from STK Push response |

**Response - Pending:**
```json
{
  "status": "pending",
  "message": "Waiting for payment confirmation"
}
```

**Response - Completed:**
```json
{
  "status": "completed",
  "message": "Payment successful",
  "mpesaReceiptNumber": "ABC123XYZ",
  "orderNumber": "#1001",
  "orderStatusUrl": "https://store.myshopify.com/12345/orders/abc123/authenticate?key=xyz"
}
```

**Response - Failed:**
```json
{
  "status": "failed",
  "message": "Payment was cancelled by user"
}
```

**Response - Order Error:**
```json
{
  "status": "order_error",
  "message": "Payment received but order creation failed. Contact support.",
  "mpesaReceiptNumber": "ABC123XYZ"
}
```

**Response - Not Found (404):**
```json
{
  "success": false,
  "message": "Transaction not found"
}
```

---

### M-Pesa Callback

Receives payment confirmation from Safaricom. This endpoint is called by Safaricom, not by your frontend.

```
POST /api/mpesa/callback
```

**Request Body (from Safaricom):**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "12345-67890-1",
      "CheckoutRequestID": "ws_CO_01012024120000123456789",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 3000 },
          { "Name": "MpesaReceiptNumber", "Value": "ABC123XYZ" },
          { "Name": "TransactionDate", "Value": 20240101120000 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```

**Result Codes:**

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Insufficient balance |
| 1032 | Request cancelled by user |
| 1037 | Timeout (user didn't respond) |
| 2001 | Wrong PIN entered |

**Response:**
```json
{
  "ResultCode": 0,
  "ResultDesc": "Success"
}
```

---

## Phone Number Format

The API accepts multiple phone number formats and converts them to `254XXXXXXXXX`:

| Input Format | Converted To |
|--------------|--------------|
| `0712345678` | `254712345678` |
| `+254712345678` | `254712345678` |
| `254712345678` | `254712345678` |
| `712345678` | `254712345678` |

**Validation Rules:**
- Must be a Kenyan mobile number
- Safaricom (07XX) or Airtel (01XX) prefixes accepted
- 9-12 digits depending on format

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": ["Array of specific validation errors"]
}
```

**Common HTTP Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 404 | Not Found (transaction not found) |
| 500 | Internal Server Error |

---

## CORS Configuration

The API only accepts requests from configured origins:

```env
CORS_ORIGINS=https://khoiscollections.co.ke,https://khoiscollections-co-ke-trade.myshopify.com
```

Requests from other origins will be rejected.

---

## Rate Limiting

Currently no rate limiting is implemented. For production, consider adding:

```javascript
// Using express-rate-limit
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Webhook Security

The callback endpoint should only accept requests from Safaricom's IP ranges. Consider adding IP validation:

```javascript
// Safaricom IP ranges (verify with Safaricom)
const SAFARICOM_IPS = [
  '196.201.214.0/24',
  '196.201.213.0/24'
];

// Middleware to validate Safaricom IPs
function validateSafaricomIP(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  // Validate IP is in Safaricom range
  // ...
  next();
}
```

---

## Example: Complete Payment Flow

### 1. Frontend initiates payment

```javascript
const response = await fetch('https://api.yourdomain.com/api/mpesa/stkpush', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '254712345678',
    email: 'customer@example.com',
    shipping: {
      fullName: 'John Doe',
      address: '123 Main St',
      city: 'Nairobi',
      county: 'Nairobi',
      notes: ''
    },
    cartItems: [
      { variant_id: 123, quantity: 1, title: 'Product', price: 1000 }
    ],
    amount: 1000
  })
});

const { checkoutRequestId } = await response.json();
```

### 2. Frontend polls for status

```javascript
const pollStatus = async (checkoutRequestId) => {
  const response = await fetch(
    `https://api.yourdomain.com/api/mpesa/status/${checkoutRequestId}`
  );
  const result = await response.json();

  if (result.status === 'completed') {
    // Redirect to order confirmation
    window.location.href = result.orderStatusUrl;
  } else if (result.status === 'failed') {
    // Show error
    alert(result.message);
  } else {
    // Continue polling (status is 'pending')
    setTimeout(() => pollStatus(checkoutRequestId), 3000);
  }
};
```

### 3. Safaricom sends callback

When customer completes payment, Safaricom POSTs to your callback URL. The backend:
1. Parses the callback
2. Updates transaction status
3. Creates Shopify order
4. Stores order details for status endpoint

### 4. Frontend receives success

The polling detects `completed` status and redirects to Shopify order page.
