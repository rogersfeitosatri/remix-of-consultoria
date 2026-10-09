import { handleStoreStripeWebhook } from './handler.ts';
Deno.serve((req) => handleStoreStripeWebhook(req));
