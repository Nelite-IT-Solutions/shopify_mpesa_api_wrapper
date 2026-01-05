/**
 * Shopify Admin API Service
 * Handles order creation and management
 */

const axios = require('axios');

class ShopifyService {
  constructor() {
    this.storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = '2024-01'; // Use latest stable version

    this.baseUrl = `https://${this.storeDomain}/admin/api/${this.apiVersion}`;
  }

  /**
   * Make authenticated request to Shopify Admin API
   */
  async request(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Shopify API Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors || error.message);
    }
  }

  /**
   * Create a completed order (paid via M-Pesa)
   * @param {Object} orderData - Order details
   * @returns {Object} Created order with order_status_url
   */
  async createOrder(orderData) {
    const {
      lineItems,
      shippingAddress,
      email,
      phone,
      totalPrice,
      mpesaReceiptNumber,
      note,
    } = orderData;

    // Build line items for Shopify
    const shopifyLineItems = lineItems.map(item => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
      // If variant_id is not available, use title and price
      ...(item.variant_id ? {} : {
        title: item.title,
        price: item.price,
        requires_shipping: true,
      }),
    }));

    // Build shipping address
    const shopifyShippingAddress = {
      first_name: shippingAddress.firstName || shippingAddress.name?.split(' ')[0] || '',
      last_name: shippingAddress.lastName || shippingAddress.name?.split(' ').slice(1).join(' ') || '',
      address1: shippingAddress.address1 || shippingAddress.address,
      address2: shippingAddress.address2 || '',
      city: shippingAddress.city,
      province: shippingAddress.county || shippingAddress.province || '',
      country: shippingAddress.country || 'Kenya',
      country_code: shippingAddress.countryCode || 'KE',
      zip: shippingAddress.zip || shippingAddress.postalCode || '',
      phone: phone || shippingAddress.phone,
    };

    const orderPayload = {
      order: {
        line_items: shopifyLineItems,
        customer: {
          first_name: shopifyShippingAddress.first_name,
          last_name: shopifyShippingAddress.last_name,
          email: email || null,
          phone: phone,
        },
        shipping_address: shopifyShippingAddress,
        billing_address: shopifyShippingAddress,
        financial_status: 'paid', // Mark as paid
        fulfillment_status: null, // Unfulfilled
        send_receipt: !!email, // Send receipt if email provided
        send_fulfillment_receipt: !!email,
        note: note || `Paid via M-Pesa. Receipt: ${mpesaReceiptNumber}`,
        note_attributes: [
          { name: 'Payment Method', value: 'M-Pesa' },
          { name: 'M-Pesa Receipt', value: mpesaReceiptNumber },
        ],
        tags: 'mpesa-payment',
        transactions: [
          {
            kind: 'sale',
            status: 'success',
            amount: totalPrice,
            gateway: 'M-Pesa',
          },
        ],
      },
    };

    console.log('Creating Shopify Order:', JSON.stringify(orderPayload, null, 2));

    const response = await this.request('POST', '/orders.json', orderPayload);

    console.log('Order Created:', {
      id: response.order.id,
      name: response.order.name,
      order_status_url: response.order.order_status_url,
    });

    return {
      id: response.order.id,
      name: response.order.name, // e.g., "#1001"
      orderNumber: response.order.order_number,
      orderStatusUrl: response.order.order_status_url,
      totalPrice: response.order.total_price,
      createdAt: response.order.created_at,
    };
  }

  /**
   * Create order from cart data retrieved from Shopify storefront
   * @param {Object} cartData - Cart data from storefront
   * @param {Object} shippingInfo - Shipping information from form
   * @param {string} mpesaReceiptNumber - M-Pesa receipt number
   * @returns {Object} Created order
   */
  async createOrderFromCart(cartData, shippingInfo, mpesaReceiptNumber) {
    const lineItems = cartData.items.map(item => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
    }));

    return this.createOrder({
      lineItems,
      shippingAddress: {
        name: shippingInfo.fullName,
        address: shippingInfo.address,
        city: shippingInfo.city,
        county: shippingInfo.county,
        country: 'Kenya',
        countryCode: 'KE',
        phone: shippingInfo.phone,
      },
      email: shippingInfo.email,
      phone: shippingInfo.phone,
      totalPrice: cartData.total_price / 100, // Shopify returns price in cents
      mpesaReceiptNumber,
      note: shippingInfo.notes || '',
    });
  }

  /**
   * Get cart data from Shopify (for validation)
   * Note: This uses Storefront API cart token if available
   */
  async getProduct(productId) {
    const response = await this.request('GET', `/products/${productId}.json`);
    return response.product;
  }

  /**
   * Verify variant exists and get its details
   */
  async getVariant(variantId) {
    const response = await this.request('GET', `/variants/${variantId}.json`);
    return response.variant;
  }

  /**
   * Check inventory for a variant
   */
  async checkInventory(variantId) {
    try {
      const variant = await this.getVariant(variantId);
      return {
        available: variant.inventory_quantity > 0 || variant.inventory_policy === 'continue',
        quantity: variant.inventory_quantity,
      };
    } catch (error) {
      console.error('Inventory check failed:', error.message);
      return { available: true, quantity: 0 }; // Default to available if check fails
    }
  }
}

module.exports = new ShopifyService();
