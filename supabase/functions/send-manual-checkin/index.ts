import { handleManualCheckin } from './handler.ts';
Deno.serve(req => handleManualCheckin(req));
