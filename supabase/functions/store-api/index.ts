import { handleStoreApi } from './handler.ts';
Deno.serve((req) => handleStoreApi(req));
