import { isQuestionVisibleSemantic } from "./checkinVisibility.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
export function uuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
export function identity(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 254) return null;
  const s = v.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s.toLowerCase();
  if (!/^[+\d\s().-]+$/.test(s)) return null;
  let d = s.replace(/\D/g, "");
  if (!s.startsWith("+") && (d.length === 10 || d.length === 11)) d = "55" + d;
  if (d.length < 10 || d.length > 15 || d.startsWith("0")) return null;
  if (d.startsWith("55") && d.length === 13 && d[4] === "9" && /[6-9]/.test(d[5])) d = d.slice(0,4) + d.slice(5);
  return d;
}
export function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function operational(c: any, today = localDay()) {
  return c?.is_active === true && c.is_frozen !== true && !c.archived_at && !c.ended_at && (!c.end_date || c.end_date >= today) && c.has_checkin === true;
}
export function deadline(d: any, c: any): number {
  const sent = Date.parse(d.sent_at);
  const explicit = d.response_deadline || d.due_at;
  const end = explicit ? Date.parse(explicit) : sent + (c.checkin_response_window_hours ?? 36) * 36e5;
  return Number.isFinite(sent) && Number.isFinite(end) ? end : 0;
}
class PublicError extends Error {}
const reject = (code: string) => { throw new PublicError(code); };
const messages: Record<string,string> = {
 INVALID_LINK: "Este link de check-in não está disponível. Peça um novo ao seu nutricionista.",
 EXPIRED: "O prazo para responder este check-in expirou.",
 ALREADY_SUBMITTED: "Este check-in já foi respondido.",
 NOT_ELIGIBLE: "Não foi possível registrar este check-in no momento.",
 INVALID_PAYLOAD: "Confira as respostas e tente novamente.",
 RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
 INTERNAL: "Não foi possível enviar agora. Tente novamente.",
};
export const errorJson = (code: string, status = 200) => json({ valid: false, error: code, message: messages[code] || messages.INTERNAL }, status);
async function readBody(req: Request) {
  if (!req.body) return reject("INVALID_PAYLOAD");
  const reader = req.body.getReader(); let size=0; const chunks: Uint8Array[]=[];
  for (;;) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>131072){await reader.cancel(); return reject("INVALID_PAYLOAD");} chunks.push(value); }
  const joined=new Uint8Array(size);let off=0;for(const c of chunks){joined.set(c,off);off+=c.length;}
  try { const body=JSON.parse(new TextDecoder().decode(joined)); if(!body||Array.isArray(body)||typeof body!=="object")return reject("INVALID_PAYLOAD");return body; } catch { return reject("INVALID_PAYLOAD"); }
}
async function db<T = any>(query: PromiseLike<{data: T; error: any}>): Promise<T> {
  const {data,error}=await query; if(error) throw new Error("database_unavailable"); return data;
}
async function context(s: any, b: any) {
  const ident=identity(b.phone || b.email); if(!ident) return reject("INVALID_LINK");
  let d:any;
  const fields="id,user_id,client_id,checkin_form_id,form_version_id,sent_at,status,response_deadline,due_at";
  if(b.dispatchToken !== undefined) {
    if(!uuid(b.dispatchToken)) return reject("INVALID_LINK");
    d=await db(s.from("checkin_dispatches").select(fields).eq("dispatch_token",b.dispatchToken).maybeSingle());
  } else {
    // No global phone scan: a legacy link must identify this exact client and form.
    if(!uuid(b.clientId)||!uuid(b.formId)) return reject("INVALID_LINK");
    d=await db(s.from("checkin_dispatches").select(fields).eq("client_id",b.clientId).eq("checkin_form_id",b.formId).in("status",["sent","responded"]).order("sent_at",{ascending:false}).limit(1).maybeSingle());
  }
  if(!d || (b.clientId && b.clientId!==d.client_id) || (b.formId && b.formId!==d.checkin_form_id)) return reject("INVALID_LINK");
  const c:any=await db(s.from("clients").select("id,user_id,phone,email,is_active,is_frozen,archived_at,ended_at,end_date,has_checkin,checkin_response_window_hours").eq("id",d.client_id).maybeSingle());
  if(!c||c.user_id!==d.user_id || ![identity(c.phone),identity(c.email)].includes(ident)) return reject("INVALID_LINK");
  if(!operational(c)) return reject("NOT_ELIGIBLE");
  const f:any=await db(s.from("checkin_forms").select("id,user_id,is_active,archived_at,current_version_id,title,description").eq("id",d.checkin_form_id).maybeSingle());
  if(!f||!f.is_active||f.archived_at||f.user_id!==c.user_id) return reject("INVALID_LINK");
  const previous:any=await db(s.from("checkin_responses").select("id").eq("dispatch_id",d.id).limit(1));
  if(previous.length||d.status==="responded") return reject("ALREADY_SUBMITTED");
  if(d.status!=="sent"||!d.sent_at||Date.parse(d.sent_at)>Date.now()) return reject("INVALID_LINK");
  const until=deadline(d,c); const expired=Date.now()>until;
  return {d,c,f,expired,until};
}
export function cleanAnswers(raw: any, questions: any[]) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).length>200) return reject("INVALID_PAYLOAD");
  const byId=new Map<string,any>();for(const q of questions){byId.set(q.id,q);if(q.source_question_id)byId.set(q.source_question_id,q);}
  const clean:Record<string,any>={};
  for(const [qid,r] of Object.entries(raw)) {
    const q=byId.get(qid); if(!q||!r||typeof r!=="object"||Array.isArray(r))return reject("INVALID_PAYLOAD");
    const a=(r as any).answer;const comment=(r as any).comment;
    if(comment!=null&&(typeof comment!=="string"||comment.length>5000))return reject("INVALID_PAYLOAD");
    const primitive=(v:any)=>v===null||typeof v==="boolean"||(typeof v==="number"&&Number.isFinite(v))||(typeof v==="string"&&v.length<=5000);
    if(a!==undefined && !(primitive(a)||(Array.isArray(a)&&a.length<=100&&a.every(primitive))))return reject("INVALID_PAYLOAD");
    const key=q.source_question_id||q.id;
    if(clean[key])return reject("INVALID_PAYLOAD");
    clean[key]={answer:a??null,comment:comment??null};
  }
  const canonicalQuestions=questions.map(q=>({...q,id:q.source_question_id||q.id}));
  const answers=Object.fromEntries(Object.entries(clean).map(([id,r])=>[id,r.answer]));
  for(const q of canonicalQuestions) {
    if(!isQuestionVisibleSemantic(q,canonicalQuestions,answers))continue;
    const r=clean[q.id];const a=r?.answer;
    const empty=a===undefined||a===null||a===""||(Array.isArray(a)&&!a.length);
    if(q.is_required&&empty)return reject("INVALID_PAYLOAD");
    if(q.has_comment_field&&q.comment_field_required&&!r?.comment?.trim())return reject("INVALID_PAYLOAD");
    if(!empty&&q.question_type==="scale") {
      const n=Number(a);if(!Number.isFinite(n)||n<(q.scale_min??0)||n>(q.scale_max??10))return reject("INVALID_PAYLOAD");
    }
  }
  if(!Object.keys(clean).length||!Object.values(clean).some((r:any)=>r.answer!==null&&r.answer!==""))return reject("INVALID_PAYLOAD");
  return clean;
}
export function handler(mode: "verify" | "submit") {
 return async (req: Request): Promise<Response> => {
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return errorJson("INVALID_PAYLOAD",405);
  try {
   const s=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
   const b=await readBody(req);
   const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
   const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
   const key=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
   const allowed=await db(s.rpc("hit_rate_limit",{p_bucket:"checkin_"+mode,p_key:key,p_max:mode==="verify"?60:30,p_window_seconds:3600}));
   if(allowed!==true)return errorJson("RATE_LIMITED");
   const {d,c,f,expired,until}=await context(s,b);
   if(expired) return mode === "verify" ? json({valid:true,clientId:c.id,expired:true}) : errorJson("EXPIRED");
   const version=d.form_version_id||f.current_version_id;
   if(!version)return errorJson("INVALID_LINK");
   const v:any=await db(s.from("checkin_form_versions").select("id,form_id,status").eq("id",version).maybeSingle());
   if(!v||v.form_id!==f.id||!["published","superseded"].includes(v.status))return errorJson("INVALID_LINK");
   const qs:any=await db(s.from("checkin_form_version_questions").select("id,source_question_id,question_text,question_key,question_type,is_required,options,scale_min,scale_max,conditional_logic,config,has_comment_field,comment_field_required,comment_field_label,order_index").eq("version_id",version));
   if(!qs.length)return errorJson("INVALID_LINK");
   if(mode === "verify")return json({valid:true,clientId:c.id,expired:false,
     windowHours:Math.max(0,(until-Date.parse(d.sent_at))/36e5),
     form:{id:f.id,title:f.title,description:f.description,is_active:true},
     formVersionId:version,questions:qs.sort((a:any,b:any)=>a.order_index-b.order_index).map((q:any)=>({...q,id:q.source_question_id||q.id}))});
   if(b.formVersionId && b.formVersionId!==version)return errorJson("INVALID_LINK");
   const clean=cleanAnswers(b.responses,qs);
   const {data,error}=await s.rpc("commit_public_checkin_response",{p_dispatch_id:d.id,p_form_version_id:version,p_responses:clean,p_questions_snapshot:qs});
   if(error)throw new Error("commit_failed");
   if(data?.error)return errorJson(data.error);
   // Existing DB triggers register the response and link the nutrition review.
   // No WhatsApp/email/push side effects from public submission.
   return json({success:true});
  } catch(e) { return errorJson(e instanceof PublicError?e.message:"INTERNAL",e instanceof PublicError?200:503); }
 };
}
