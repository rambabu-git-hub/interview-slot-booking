import React,{useEffect,useState} from "react";
import{createRoot}from"react-dom/client";
import{createClient}from"@supabase/supabase-js";
import"./style.css";

const URL=import.meta.env.VITE_SUPABASE_URL;
const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
const db=URL&&KEY?createClient(URL,KEY):null;

function App(){
 const [mode,setMode]=useState("book"),[slots,setSlots]=useState([]),[bookings,setBookings]=useState([]);
 const [company,setCompany]=useState(""),[name,setName]=useState(""),[date,setDate]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState("");
 const [candidate,setCandidate]=useState(""),[editing,setEditing]=useState(null),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 async function load(){
  if(!db)return;
  const {data,error}=await db.from("interview_slots").select("*").order("interview_date").order("start_time");
  if(error){setMsg(error.message);return}
  setSlots(data||[]);
  const {data:b}=await db.from("interview_bookings").select("slot_id,candidate_name");
  setBookings(b||[]);
 }
 useEffect(()=>{load()},[]);
 const booked=new Map(bookings.map(b=>[b.slot_id,b.candidate_name]));
 function reset(){setCompany("");setName("");setDate("");setStart("");setEnd("");setEditing(null)}
 async function save(e){
  e.preventDefault();setMsg("");
  if(end<=start){setMsg("End time must be later than start time.");return}
  setBusy(true);
  const payload={company:company.trim(),slot_name:name.trim(),interview_date:date,start_time:start,end_time:end};
  const result=editing
   ?await db.from("interview_slots").update(payload).eq("id",editing)
   :await db.from("interview_slots").insert(payload);
  setBusy(false);
  if(result.error){setMsg(result.error.message.includes("overlap")?"This time overlaps another slot.":result.error.message);return}
  reset();setMsg(editing?"Slot updated.":"Slot added.");load();
 }
 async function edit(s){setEditing(s.id);setCompany(s.company);setName(s.slot_name);setDate(s.interview_date);setStart(s.start_time.slice(0,5));setEnd(s.end_time.slice(0,5));setMode("admin");window.scrollTo(0,0)}
 async function book(id){
  if(!candidate.trim()){setMsg("Enter your name before booking.");return}
  setBusy(true);setMsg("");
  const {error}=await db.rpc("book_interview_slot",{p_slot_id:id,p_candidate_name:candidate.trim()});
  setBusy(false);
  if(error){setMsg(error.message.includes("SLOT_TAKEN")?"Sorry, this slot was just booked. Please choose another.":error.message);load();return}
  setMsg("Booking confirmed!");setCandidate("");load();
 }
 const fmt=t=>new Date("2000-01-01T"+t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
 if(!db)return <main className="wrap"><h1>Interview Slot Booking</h1><div className="panel"><h2>Connect Supabase first</h2><p>Create a <code>.env</code> file with your Supabase project URL and anon key. See the setup steps in README.md.</p></div></main>;
 return <main className="wrap">
  <header><div><b>▦ Interview Slot Booking</b><small>Simple interview scheduling</small></div><nav><button className={mode==="book"?"active":""} onClick={()=>setMode("book")}>Book a slot</button><button className={mode==="admin"?"active":""} onClick={()=>setMode("admin")}>Manage slots</button></nav></header>
  {msg&&<p className="msg">{msg}</p>}
  {mode==="admin"?<section className="panel"><h2>{editing?"Edit slot":"Add interview slot"}</h2>
   <form onSubmit={save}>
    <label>Interview company<input required value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. Deloitte"/></label>
    <label>Name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Interviewer or slot name"/></label>
    <label>Interview date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <div className="two"><label>Start time<input required type="time" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End time<input required type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
    <div className="two"><button className="primary" disabled={busy}>{busy?"Saving…":editing?"Save changes":"Add slot"}</button>{editing&&<button type="button" onClick={reset}>Cancel</button>}</div>
   </form></section>:<section className="panel"><h2>Available interview slots</h2><label>Your name<input value={candidate} onChange={e=>setCandidate(e.target.value)} placeholder="Enter your full name"/></label>
   {slots.length===0?<p>No slots available yet.</p>:<div className="cards">{slots.map(s=>{const who=booked.get(s.id);return <article className="slot" key={s.id}><div><b>{s.company}</b><div>{s.slot_name}</div><small>{s.interview_date} · {fmt(s.start_time)} – {fmt(s.end_time)}</small></div>{who?<span className="taken">Booked</span>:<button className="primary" disabled={busy} onClick={()=>book(s.id)}>Book slot</button>}</article>})}</div>}
  </section>}
  <section className="panel"><h2>{mode==="admin"?"All slots":"Your bookings"}</h2>{slots.map(s=><div className="row" key={s.id}><div><b>{s.company} — {s.slot_name}</b><small>{s.interview_date} · {fmt(s.start_time)}–{fmt(s.end_time)} · {booked.has(s.id)?"Booked":"Available"}</small></div>{mode==="admin"&&<button onClick={()=>edit(s)}>Edit</button>}</div>)}</section>
  <p className="foot">Booking is confirmed by the database; a slot can only be booked once.</p>
 </main>
}
createRoot(document.getElementById("root")).render(<App/>);