/**
 * M-Pesa Payment Routes
 * Handles STK Push initiation, callbacks, and status queries
 */

const express = require('express');
const router = express.Router();
const darajaService = require('../services/daraja');
const shopifyService = require('../services/shopify');
const { validatePaymentRequest } = require('../utils/validators');

// In-memory store for pending transactions
// In production, use Redis or a database
const pendingTransactions = new Map();

/**
 * POST /api/mpesa/stkpush
 * Initiate STK Push payment
 */
router.post('/stkpush', async (req, res) => {
  try {
    const { phone, email, shipping, cartItems, amount, cartToken } = req.body;

    // Validate request
    const validation = validatePaymentRequest({
      phone,
      email,
      shipping,
      cartItems,
      amount,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    // Generate order reference (short, unique)
    const orderRef = `ORD${Date.now().toString(36).toUpperCase()}`;

    // Initiate STK Push
    const stkResult = await darajaService.initiateSTKPush(
      validation.formattedPhone,
      validation.amount,
      orderRef,
      'Order Payment'
    );

    if (!stkResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to initiate payment. Please try again.',
      });
    }

    // Store pending transaction
    pendingTransactions.set(stkResult.checkoutRequestId, {
      checkoutRequestId: stkResult.checkoutRequestId,
      merchantRequestId: stkResult.merchantRequestId,
      orderRef,
      phone: validation.formattedPhone,
      email,
      shipping,
      cartItems,
      amount: validation.amount,
      cartToken,
      status: 'pending',
      createdAt: new Date(),
    });

    // Clean up old pending transactions (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [id, txn] of pendingTransactions) {
      if (new Date(txn.createdAt).getTime() < tenMinutesAgo) {
        pendingTransactions.delete(id);
      }
    }

    res.json({
      success: true,
      message: 'Payment request sent to your phone',
      checkoutRequestId: stkResult.checkoutRequestId,
      orderRef,
    });
  } catch (error) {
    console.error('STK Push Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment initiation failed',
    });
  }
});

/**
 * POST /api/mpesa/callback
 * Handle Safaricom callback (payment confirmation)
 */
router.post('/callback', async (req, res) => {
  try {
    console.log('M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));

    // Parse callback data
    const callbackResult = darajaService.parseCallback(req.body);

    console.log('Parsed Callback:', callbackResult);

    // Find pending transaction
    const transaction = pendingTransactions.get(callbackResult.checkoutRequestId);

    if (!transaction) {
      console.warn('Transaction not found:', callbackResult.checkoutRequestId);
      // Still respond to Safaricom with success
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (callbackResult.success) {
      // Payment successful - create Shopify order
      try {
        const order = await shopifyService.createOrderFromCart(
          { items: transaction.cartItems, total_price: transaction.amount * 100 },
          {
            fullName: transaction.shipping.fullName,
            address: transaction.shipping.address,
            city: transaction.shipping.city,
            county: transaction.shipping.county,
            phone: transaction.phone,
            email: transaction.email,
            notes: transaction.shipping.notes,
          },
          callbackResult.mpesaReceiptNumber
        );

        // Update transaction status
        transaction.status = 'completed';
        transaction.mpesaReceiptNumber = callbackResult.mpesaReceiptNumber;
        transaction.shopifyOrder = order;
        transaction.completedAt = new Date();

        console.log('Order created successfully:', order);
      } catch (orderError) {
        console.error('Failed to create Shopify order:', orderError);
        transaction.status = 'payment_received_order_failed';
        transaction.error = orderError.message;
      }
    } else {
      // Payment failed or cancelled
      transaction.status = 'failed';
      transaction.error = callbackResult.resultDesc;
    }

    pendingTransactions.set(callbackResult.checkoutRequestId, transaction);

    // Always respond with success to Safaricom
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Callback Processing Error:', error);
    // Still respond with success to avoid retries
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

/**
 * GET /api/mpesa/status/:checkoutRequestId
 * Poll payment status
 */
router.get('/status/:checkoutRequestId', async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    // Check local store first
    const transaction = pendingTransactions.get(checkoutRequestId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        message: 'Transaction not found',
      });
    }

    // If already completed or failed, return stored status
    if (transaction.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed',
        message: 'Payment successful',
        orderStatusUrl: transaction.shopifyOrder?.orderStatusUrl,
        orderNumber: transaction.shopifyOrder?.name,
        mpesaReceiptNumber: transaction.mpesaReceiptNumber,
      });
    }

    if (transaction.status === 'failed') {
      return res.json({
        success: false,
        status: 'failed',
        message: transaction.error || 'Payment failed or was cancelled',
      });
    }

    if (transaction.status === 'payment_received_order_failed') {
      return res.json({
        success: false,
        status: 'order_error',
        message: 'Payment received but order creation failed. Please contact support.',
        mpesaReceiptNumber: transaction.mpesaReceiptNumber,
      });
    }

    // Still pending - optionally query Daraja for status
    // This is useful if callback was delayed
    const statusResult = await darajaService.querySTKStatus(checkoutRequestId);

    if (statusResult.resultCode === 0 || statusResult.resultCode === '0') {
      // Payment successful but callback not yet processed
      return res.json({
        success: true,
        status: 'processing',
        message: 'Payment received, creating order...',
      });
    }

    if (statusResult.resultCode === 'PENDING' || statusResult.resultCode === 1) {
      return res.json({
        success: false,
        status: 'pending',
        message: 'Waiting for payment confirmation...',
      });
    }

    // Payment failed
    return res.json({
      success: false,
      status: 'failed',
      message: statusResult.resultDesc || 'Payment failed or was cancelled',
    });
  } catch (error) {
    console.error('Status Check Error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to check payment status',
    });
  }
});

/**
 * POST /api/mpesa/validate-cart
 * Validate cart before payment (optional endpoint)
 */
router.post('/validate-cart', async (req, res) => {
  try {
    const { cartItems, totalAmount } = req.body;

    // Basic validation
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        valid: false,
        error: 'Cart is empty',
      });
    }

    // Optionally verify each variant exists and has stock
    // This prevents payment for out-of-stock items

    res.json({
      valid: true,
      message: 'Cart validated successfully',
    });
  } catch (error) {
    console.error('Cart Validation Error:', error);
    res.status(500).json({
      valid: false,
      error: 'Failed to validate cart',
    });
  }
});

module.exports = router;
