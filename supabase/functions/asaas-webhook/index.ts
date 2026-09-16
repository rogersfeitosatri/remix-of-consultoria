import { handleAsaasWebhook } from "./handler.ts";

Deno.serve((req) => handleAsaasWebhook(req));
