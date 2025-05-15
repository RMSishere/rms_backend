import checkoutNodeJssdk = require('@paypal/checkout-server-sdk');
import paypal = require('paypal-node-sdk');

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

paypal.configure({
  'mode': process.env.PAYPAL_MODE, //sandbox or live
  'client_id': clientId,
  'client_secret': clientSecret
});

/**
 *
 * Set up and return PayPal JavaScript SDK environment with PayPal access credentials.
 * This sample uses SandboxEnvironment. In production, use LiveEnvironment.
 *
 */
function environment() {

  if (process.env.PAYPAL_MODE == 'live') {
    return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
  }
  return new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
}

/**
 *
 * Returns PayPal HTTP client instance with environment that has access
 * credentials context. Use this instance to invoke PayPal APIs, provided the
 * credentials have access.
 */
export const payPalClient = () => {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
};
