import { handleManualBooking } from './handler.ts';
Deno.serve(req => handleManualBooking(req));
