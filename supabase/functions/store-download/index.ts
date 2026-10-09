import { handleStoreDownload } from './handler.ts';
Deno.serve((req) => handleStoreDownload(req));
