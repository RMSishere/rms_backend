const Stripe = require('stripe');

// Replace this key if needed
const stripe = new Stripe('REMOVED_STRIPE_TEST_KEY', {
  apiVersion: '2025-04-30.basil',
});

(async () => {
  try {
    console.log('🔍 Checking Stripe API connection...');

    const balance = await stripe.balance.retrieve();

    console.log('✅ Stripe is configured correctly!');
    console.log('💰 Available balance:');
    console.dir(balance.available, { depth: null });
  } catch (err) {
    console.error('❌ Stripe is NOT configured correctly.');
    console.error('Error message:', err.message);
  }
})();
DB_URL="mongodb+srv://test123:test123@rmsdb.vvere.mongodb.net/?retryWrites=true&w=majority&appName=rmsDB"
