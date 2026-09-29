import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const pad = n => String(n).padStart(2,"0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monday = d => { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; };
const plusDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const pretty = d => d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
const timeLabel = t => { if(!t) return ""; const [h,m]=t.slice(0,5).split(":").map(Number); const x=new Date(); x.setHours(h,m); return x.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"}); };
const emptyForm = {company:"",name:"",date:"",start:"",end:"",notes:""};

export default function App(){
 const [week,setWeek]=useState(()=>monday(new Date()));
 const [slots,setSlots]=useState([]);
 const [bookings,setBookings]=useState([]);
 const [view,setView]=useState("calendar");
 const [form,setForm]=useState(emptyForm);
 const [editing,setEditing]=useState(null);
 const [bookingName,setBookingName]=useState("");
 const [selected,setSelected]=useState(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [admin,setAdmin]=useState(false);
 const [adminPin,setAdminPin]=useState("");
 const [showAdmin,setShowAdmin]=useState(false);
 const [filter,setFilter]=useState("");
 const start=monday(week), end=plusDays(start,7);
 const days=Array.from({length:7},(_,i)=>plusDays(start,i));
 const configured=!!supabase;

 async function load(){
  if(!supabase){setSlots([]);setBookings([]);return;}
  const from=dateKey(start), to=dateKey(end);
  const [s,b]=await Promise.all([
   supabase.from("interview_slots").select("*").gte("interview_date",from).lt("interview_date",to).order("start_time"),
   supabase.from("interview_bookings").select("*")
  ]);
  if(s.error) setNotice("Slots: "+s.error.message);
  else setSlots(s.data||[]);
  if(b.error) setNotice("Bookings: "+b.error.message);
  else setBookings(b.data||[]);
 }
 useEffect(()=>{load();},[week]);
 const bookedBySlot=useMemo(()=>Object.fromEntries(bookings.map(b=>[b.slot_id,b])),[bookings]);
 const weekSlots=slots.filter(s=>!filter || s.company?.toLowerCase().includes(filter.toLowerCase()));
 function change(k,v){setForm(f=>({...f,[k]:v}));}
 function openEdit(s){setEditing(s.id);setForm({company:s.company||"",name:s.slot_name||"",date:s.interview_date,start:s.start_time?.slice(0,5)||"",end:s.end_time?.slice(0,5)||"",notes:s.notes||""});setView("manage");}
 async function saveSlot(e){
  e.preventDefault(); if(!supabase){setNotice("Add Supabase environment variables in Vercel first.");return;}
  if(form.end<=form.start){setNotice("End time must be later than start time.");return;}
  setBusy(true);setNotice("");
  const payload={company:form.company.trim(),slot_name:form.name.trim(),interview_date:form.date,start_time:form.start,end_time:form.end,notes:form.notes.trim()||null};
  const result=editing?await supabase.from("interview_slots").update(payload).eq("id",editing):await supabase.from("interview_slots").insert(payload);
  setBusy(false);
  if(result.error){setNotice(result.error.message);return;}
  setNotice(editing?"Slot updated.":"Slot added.");setForm(emptyForm);setEditing(null);await load();
 }
 async function bookSlot(slot){
  if(!bookingName.trim()){setNotice("Enter your name before booking.");return;}
  setBusy(true);setNotice("");
  const {error}=await supabase.from("interview_bookings").insert({slot_id:slot.id,candidate_name:bookingName.trim()});
  setBusy(false);
  if(error){
   if(error.message.toLowerCase().includes("overlap")||error.code==="23P01"||error.code==="23505") setNotice("This time is already booked. Check the booking name or choose another time.");
   else setNotice(error.message);
  } else {setNotice("Booking confirmed.");setSelected(null);setBookingName("");await load();}
 }
 async function deleteOld(){
  if(!supabase)return;
  const cutoff=dateKey(monday(new Date()));
  if(!confirm(`Delete all slots and bookings before ${cutoff}? This cannot be undone.`))return;
  setBusy(true);
  const {error}=await supabase.rpc("delete_previous_interview_weeks",{cutoff_date:cutoff});
  setBusy(false);
  setNotice(error?error.message:"Previous-week records deleted.");await load();
 }
 async function verifyAdmin(){
  const pin=import.meta.env.VITE_ADMIN_PIN;
  if(pin && adminPin===pin){setAdmin(true);setShowAdmin(false);setNotice("Admin mode enabled in this browser.");}
  else setNotice("Admin PIN is not configured or does not match.");
 }
 const grouped=day=>weekSlots.filter(s=>s.interview_date===dateKey(day)).sort((a,b)=>a.start_time.localeCompare(b.start_time));
 return <div className="app">
  <header className="topbar">
   <div className="brandmark">TZ</div><div className="brand"><b>TekZone</b><span>Interview Schedule Slot Booking Dashboard</span></div>
   <div className="top-actions"><button className={view==="calendar"?"active":""} onClick={()=>setView("calendar")}>Calendar</button><button className={view==="manage"?"active":""} onClick={()=>setView("manage")}>Manage slots</button><button className="admin-btn" onClick={()=>setShowAdmin(v=>!v)}>{admin?"Admin mode":"Admin"}</button></div>
  </header>
  <main>
   <section className="welcome"><div><div className="eyebrow">TEKZONE • INTERVIEW OPERATIONS</div><h1>Interview schedule</h1><p>Plan interviews, reserve time slots, and keep everyone aligned.</p></div><div className="week-chip"><span>THIS WEEK</span><b>{pretty(start)} – {pretty(plusDays(start,6))}</b></div></section>
   {showAdmin&&<section className="admin-panel"><b>Admin access</b><p>Enter the admin PIN configured in Vercel as <code>VITE_ADMIN_PIN</code>.</p><div className="inline"><input type="password" value={adminPin} onChange={e=>setAdminPin(e.target.value)} placeholder="Admin PIN"/><button onClick={verifyAdmin}>Unlock</button></div></section>}
   {!configured&&<div className="warning">Supabase is not connected yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel Project Settings → Environment Variables.</div>}
   {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
   {view==="calendar"?<>
    <div className="toolbar"><div className="nav"><button onClick={()=>setWeek(plusDays(week,-7))}>← Previous week</button><button onClick={()=>setWeek(monday(new Date()))}>Today</button><button onClick={()=>setWeek(plusDays(week,7))}>Next week →</button></div><div className="filters"><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter by company"/><button className="primary" onClick={()=>{setView("manage");setEditing(null);setForm(emptyForm);}}>＋ Add slot</button></div></div>
    <div className="calendar-wrap"><div className="calendar">
     {days.map((day,i)=><div className="day-column" key={dateKey(day)}><div className={"day-head "+(dateKey(day)===dateKey(new Date())?"today":"")}><span>{["MON","TUE","WED","THU","FRI","SAT","SUN"][i]}</span><b>{day.getDate()}</b><small>{day.toLocaleDateString("en-IN",{month:"short"})}</small></div><div className="day-content">{grouped(day).map(s=>{const b=bookedBySlot[s.id];return <article className={"slot "+(b?"booked":"open")} key={s.id}><div className="slot-top"><span className="company">{s.company}</span><span className={"status "+(b?"red":"green")}>{b?"Booked":"Open"}</span></div><b>{s.slot_name||"Interview slot"}</b><div className="slot-time">{timeLabel(s.start_time)} – {timeLabel(s.end_time)}</div>{b&&<div className="candidate">Booked by <b>{b.candidate_name}</b></div>}{s.notes&&<p className="notes">{s.notes}</p>}<div className="slot-actions">{!b&&<button onClick={()=>setSelected(s)}>Book</button>}{admin&&<button className="edit" onClick={()=>openEdit(s)}>Edit</button>}</div></article>})}{grouped(day).length===0&&<div className="empty-day">No slots</div>}</div></div>)}
    </div></div>
    <div className="legend"><span><i className="dot green-dot"></i> Available</span><span><i className="dot red-dot"></i> Booked</span><span>All times shown in your local timezone</span></div>
   </>:<section className="manage-layout"><div className="panel"><div className="panel-head"><div><h2>{editing?"Edit interview slot":"Add interview slot"}</h2><p>Create a time window for candidates to book.</p></div><button className="subtle" onClick={()=>{setView("calendar");setEditing(null);}}>Back to calendar</button></div><form onSubmit={saveSlot} className="form-grid">
    <label>Interview company<input required value={form.company} onChange={e=>change("company",e.target.value)} placeholder="e.g. Deloitte"/></label>
    <label>Interviewer / slot name<input value={form.name} onChange={e=>change("name",e.target.value)} placeholder="e.g. Technical round"/></label>
    <label>Interview date<input required type="date" value={form.date} onChange={e=>change("date",e.target.value)}/></label>
    <label>Start time<input required type="time" value={form.start} onChange={e=>change("start",e.target.value)}/></label>
    <label>End time<input required type="time" value={form.end} onChange={e=>change("end",e.target.value)}/></label>
    <label className="full">Notes (optional)<textarea value={form.notes} onChange={e=>change("notes",e.target.value)} placeholder="Meeting link, round details, or instructions"/></label>
    <div className="full form-actions"><button className="primary" disabled={busy}>{busy?"Saving…":editing?"Save changes":"Add slot"}</button><button type="button" className="subtle" onClick={()=>{setForm(emptyForm);setEditing(null);}}>Clear</button></div>
   </form></div><div className="panel"><div className="panel-head"><div><h2>Slots this week</h2><p>{weekSlots.length} slot(s) in the selected week</p></div></div>{weekSlots.map(s=><div className="manage-row" key={s.id}><div><b>{s.company} — {s.slot_name||"Interview"}</b><span>{pretty(new Date(s.interview_date+"T00:00:00"))} · {timeLabel(s.start_time)}–{timeLabel(s.end_time)} · {bookedBySlot[s.id]?"Booked":"Open"}</span></div>{admin&&<button className="subtle" onClick={()=>openEdit(s)}>Edit</button>}</div>)}</div></section>}
   <footer><div><b>TekZone</b><span>Interview scheduling made clear.</span></div><div className="contact"><b>Emergency changes?</b><span>Reach out to Rambabu · <a href="tel:9908947844">9908947844</a></span></div></footer>
  </main>
  {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="eyebrow">RESERVE YOUR TIME</div><h2>Book interview slot</h2><p><b>{selected.company}</b> · {pretty(new Date(selected.interview_date+"T00:00:00"))}</p><div className="modal-time">{timeLabel(selected.start_time)} – {timeLabel(selected.end_time)}</div><label>Your full name<input value={bookingName} onChange={e=>setBookingName(e.target.value)} placeholder="Enter your name" autoFocus/></label><button className="primary wide" disabled={busy} onClick={()=>bookSlot(selected)}>{busy?"Booking…":"Confirm booking"}</button><p className="small">First confirmed booking reserves this time. If another person books first, select another available slot.</p></div></div>}
 </div>;
}