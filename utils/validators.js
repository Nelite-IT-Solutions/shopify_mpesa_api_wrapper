/**
 * Validation utilities for M-Pesa payment flow
 */

/**
 * Validate Kenyan phone number
 * Accepts: 0712345678, 254712345678, +254712345678, 712345678
 */
function validatePhoneNumber(phone) {
  if (!phone) {
    return { valid: false, error: 'Phone number is required' };
  }

  // Remove spaces and special characters except +
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Check patterns
  const patterns = [
    /^0[17]\d{8}$/,           // 0712345678 or 0112345678
    /^254[17]\d{8}$/,         // 254712345678
    /^\+254[17]\d{8}$/,       // +254712345678
    /^[17]\d{8}$/,            // 712345678
  ];

  const isValid = patterns.some(pattern => pattern.test(cleaned));

  if (!isValid) {
    return { valid: false, error: 'Invalid Kenyan phone number format' };
  }

  return { valid: true, formatted: formatPhoneNumber(cleaned) };
}

/**
 * Format phone number to 254XXXXXXXXX
 */
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    return '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('254')) {
    return cleaned;
  } else if (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('1'))) {
    return '254' + cleaned;
  }

  return cleaned;
}

/**
 * Validate email address
 */
function validateEmail(email) {
  if (!email) {
    return { valid: true }; // Email is optional
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);

  return {
    valid: isValid,
    error: isValid ? null : 'Invalid email address format',
  };
}

/**
 * Validate shipping address
 */
function validateShippingAddress(address) {
  const errors = [];

  if (!address.fullName || address.fullName.trim().length < 2) {
    errors.push('Full name is required');
  }

  if (!address.address || address.address.trim().length < 5) {
    errors.push('Street address is required');
  }

  if (!address.city || address.city.trim().length < 2) {
    errors.push('City is required');
  }

  if (!address.county) {
    errors.push('County is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate payment amount
 */
function validateAmount(amount) {
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    return { valid: false, error: 'Invalid amount' };
  }

  if (numAmount < 1) {
    return { valid: false, error: 'Amount must be at least KES 1' };
  }

  if (numAmount > 500000) {
    return { valid: false, error: 'Amount exceeds M-Pesa limit (KES 500,000)' };
  }

  return { valid: true, amount: Math.ceil(numAmount) };
}

/**
 * Validate cart items
 */
function validateCartItems(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Cart is empty' };
  }

  for (const item of items) {
    if (!item.variant_id && !item.title) {
      return { valid: false, error: 'Invalid cart item: missing variant_id or title' };
    }
    if (!item.quantity || item.quantity < 1) {
      return { valid: false, error: 'Invalid cart item: quantity must be at least 1' };
    }
  }

  return { valid: true };
}

/**
 * Validate complete payment request
 */
function validatePaymentRequest(data) {
  const errors = [];

  // Validate phone
  const phoneResult = validatePhoneNumber(data.phone);
  if (!phoneResult.valid) {
    errors.push(phoneResult.error);
  }

  // Validate email (if provided)
  const emailResult = validateEmail(data.email);
  if (!emailResult.valid) {
    errors.push(emailResult.error);
  }

  // Validate shipping
  const shippingResult = validateShippingAddress(data.shipping);
  if (!shippingResult.valid) {
    errors.push(...shippingResult.errors);
  }

  // Validate amount
  const amountResult = validateAmount(data.amount);
  if (!amountResult.valid) {
    errors.push(amountResult.error);
  }

  // Validate cart
  const cartResult = validateCartItems(data.cartItems);
  if (!cartResult.valid) {
    errors.push(cartResult.error);
  }

  return {
    valid: errors.length === 0,
    errors,
    formattedPhone: phoneResult.valid ? phoneResult.formatted : null,
    amount: amountResult.valid ? amountResult.amount : null,
  };
}

/**
 * List of Kenyan counties for validation
 */
const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet',
  'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
  'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga',
  'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia',
  'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit',
  'Meru', 'Migori', 'Mombasa', 'Muranga', 'Nairobi',
  'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
  'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
  'Tharaka-Nithi', 'Trans-Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga',
  'Wajir', 'West Pokot'
];

function validateCounty(county) {
  const normalized = county?.trim();
  const isValid = KENYA_COUNTIES.some(
    c => c.toLowerCase() === normalized?.toLowerCase()
  );

  return {
    valid: isValid,
    error: isValid ? null : 'Invalid county. Please select a valid Kenyan county.',
  };
}

module.exports = {
  validatePhoneNumber,
  formatPhoneNumber,
  validateEmail,
  validateShippingAddress,
  validateAmount,
  validateCartItems,
  validatePaymentRequest,
  validateCounty,
  KENYA_COUNTIES,
};
