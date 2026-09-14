const DAY=86400000;
const span:Record<string,number>={weekly:7,biweekly:14,monthly:28};
export function occurrence(anchor:string,frequency:string,today:string):string|null {
 const days=span[frequency]; if(!days||!/^\d{4}-\d{2}-\d{2}$/.test(anchor))return null;
 const start=Date.parse(anchor+'T12:00:00Z'),now=Date.parse(today+'T12:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(now)||now<start)return null;
 // Monthly/biweekly first occurrence is after the first complete interval.
 const first=start+(frequency==='weekly'?0:days*DAY);
 if(now<first)return null;
 const n=Math.floor((now-first)/(days*DAY));let date=first+n*days*DAY;
 // Dispatch on the first Monday on/after the anniversary; no drifting after failures.
 date+=((1-new Date(date).getUTCDay()+7)%7)*DAY;
 if(date>now)date-=days*DAY;
 if(date<first)return null;
 return new Date(date).toISOString().slice(0,10);
}
