import { handler } from "../_shared/publicCheckin.ts";
Deno.serve(handler("verify"));
