import Stripe from 'stripe';

// Use a placeholder during build if STRIPE_SECRET_KEY is not available
// The actual key will be used at runtime from environment variables
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover',
    typescript: true,
});
