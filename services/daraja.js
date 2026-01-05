/**
 * Daraja API Service
 * Handles M-Pesa STK Push (Lipa Na M-Pesa Online)
 * For Till Number (Buy Goods) transactions
 */

const axios = require('axios');

class DarajaService {
  constructor() {
    this.consumerKey = process.env.DARAJA_CONSUMER_KEY;
    this.consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
    this.shortcode = process.env.DARAJA_SHORTCODE;
    this.tillNumber = process.env.DARAJA_TILL_NO;
    this.passkey = process.env.DARAJA_PASSKEY;
    this.callbackUrl = process.env.DARAJA_CALLBACK_URL;
    this.environment = process.env.DARAJA_ENV || 'sandbox';

    // Set base URL based on environment
    this.baseUrl = this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get OAuth access token from Daraja
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 3599 seconds, we refresh 5 minutes early
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Daraja OAuth Error:', error.response?.data || error.message);
      throw new Error('Failed to get Daraja access token');
    }
  }

  /**
   * Generate timestamp in format YYYYMMDDHHmmss
   */
  generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate password for STK Push
   * Password = Base64(Shortcode + Passkey + Timestamp)
   */
  generatePassword(timestamp) {
    const data = `${this.shortcode}${this.passkey}${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Format phone number to 254XXXXXXXXX format
   */
  formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    } else if (cleaned.startsWith('+254')) {
      cleaned = cleaned.substring(1);
    }

    // Validate length (should be 12 digits: 254XXXXXXXXX)
    if (cleaned.length !== 12 || !cleaned.startsWith('254')) {
      throw new Error('Invalid phone number format');
    }

    return cleaned;
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   * @param {string} phoneNumber - Customer's phone number
   * @param {number} amount - Amount in KES (will be rounded to integer)
   * @param {string} accountReference - Order reference (max 12 chars)
   * @param {string} transactionDesc - Description (max 13 chars)
   * @returns {Object} STK Push response with CheckoutRequestID
   */
  async initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc = 'Payment') {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Round amount to integer (M-Pesa doesn't accept decimals)
      const roundedAmount = Math.ceil(amount);

      // Truncate reference and description to fit limits
      const reference = accountReference.substring(0, 12);
      const description = transactionDesc.substring(0, 13);

      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline', // For Till Number
        Amount: roundedAmount,
        PartyA: formattedPhone,      // Customer phone
        PartyB: this.tillNumber,       // Till number
        PhoneNumber: formattedPhone,
        CallBackURL: this.callbackUrl,
        AccountReference: reference,
        TransactionDesc: description,
      };

      console.log('STK Push Request:', {
        phone: formattedPhone,
        amount: roundedAmount,
        reference,
        shortcode: this.shortcode,
      });

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('STK Push Response:', response.data);

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          checkoutRequestId: response.data.CheckoutRequestID,
          merchantRequestId: response.data.MerchantRequestID,
          responseDescription: response.data.ResponseDescription,
        };
      } else {
        throw new Error(response.data.ResponseDescription || 'STK Push failed');
      }
    } catch (error) {
      console.error('STK Push Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errorMessage || error.message || 'STK Push failed');
    }
  }

  /**
   * Query STK Push status
   * @param {string} checkoutRequestId - The CheckoutRequestID from STK Push
   * @returns {Object} Transaction status
   */
  async querySTKStatus(checkoutRequestId) {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('STK Query Response:', response.data);

      // ResultCode 0 = Success, 1032 = Cancelled, 1037 = Timeout
      const resultCode = response.data.ResultCode;

      return {
        success: resultCode === '0' || resultCode === 0,
        resultCode,
        resultDesc: response.data.ResultDesc,
        checkoutRequestId,
      };
    } catch (error) {
      console.error('STK Query Error:', error.response?.data || error.message);
      // If query fails, assume still processing
      return {
        success: false,
        resultCode: 'PENDING',
        resultDesc: 'Transaction still processing',
        checkoutRequestId,
      };
    }
  }

  /**
   * Parse callback data from Safaricom
   * @param {Object} callbackData - Raw callback from Safaricom
   * @returns {Object} Parsed transaction result
   */
  parseCallback(callbackData) {
    try {
      const stkCallback = callbackData.Body?.stkCallback;

      if (!stkCallback) {
        throw new Error('Invalid callback format');
      }

      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      const merchantRequestId = stkCallback.MerchantRequestID;
      const checkoutRequestId = stkCallback.CheckoutRequestID;

      // If successful, extract metadata
      let metadata = {};
      if (resultCode === 0 && stkCallback.CallbackMetadata?.Item) {
        stkCallback.CallbackMetadata.Item.forEach(item => {
          metadata[item.Name] = item.Value;
        });
      }

      return {
        success: resultCode === 0,
        resultCode,
        resultDesc,
        merchantRequestId,
        checkoutRequestId,
        amount: metadata.Amount,
        mpesaReceiptNumber: metadata.MpesaReceiptNumber,
        transactionDate: metadata.TransactionDate,
        phoneNumber: metadata.PhoneNumber,
      };
    } catch (error) {
      console.error('Callback Parse Error:', error.message);
      throw new Error('Failed to parse callback data');
    }
  }
}

module.exports = new DarajaService();
