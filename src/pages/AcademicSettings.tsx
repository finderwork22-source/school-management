import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Edit3, Layers3, Loader2, Plus, Power, Trash2, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

interface AcademicYear { id:string; name:string; start_date:string|null; end_date:string|null; is_active:boolean; is_current?:boolean|null; }
interface AcademicSection { id:string; academic_year_id:string; name:string; display_order:number; is_active:boolean; }
const DEFAULT_SECTIONS=["Creche","Nursery","Primary","Lower Secondary"];

function formatDate(value:string|null){
  if(!value)return "Date not set";
  const d=new Date(`${value}T00:00:00`);
  if(Number.isNaN(d.getTime()))return value;
  return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(d);
}

export default function AcademicSettings(){
  const {school}=useSchool(); const navigate=useNavigate(); const [params,setParams]=useSearchParams();
  const structureYearId=params.get("academicYear");
  const [years,setYears]=useState<AcademicYear[]>([]); const [sections,setSections]=useState<AcademicSection[]>([]);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const [showYearModal,setShowYearModal]=useState(false); const [editingYear,setEditingYear]=useState<AcademicYear|null>(null);
  const [yearName,setYearName]=useState(""); const [startDate,setStartDate]=useState(""); const [endDate,setEndDate]=useState(""); const [makeActive,setMakeActive]=useState(false);
  const [showSectionModal,setShowSectionModal]=useState(false); const [editingSection,setEditingSection]=useState<AcademicSection|null>(null);
  const [sectionName,setSectionName]=useState(""); const [sectionOrder,setSectionOrder]=useState("1");
  const structureYear=useMemo(()=>years.find(y=>y.id===structureYearId)||null,[years,structureYearId]);
  const activeYear=useMemo(()=>years.find(y=>y.is_active)||null,[years]);
  const structureSections=useMemo(()=>sections.filter(s=>s.academic_year_id===structureYearId).sort((a,b)=>a.display_order-b.display_order),[sections,structureYearId]);

  async function loadData(){
    if(!school){setYears([]);setSections([]);setLoading(false);return;}
    setLoading(true);setError("");
    const [yr,sec]=await Promise.all([
      supabase.from("academic_years").select("id,name,start_date,end_date,is_active,is_current").eq("school_id",school.id).order("start_date",{ascending:false}),
      supabase.from("academic_sections").select("id,academic_year_id,name,display_order,is_active").eq("school_id",school.id).order("display_order",{ascending:true})
    ]);
    if(yr.error){setError(yr.error.message);setLoading(false);return;}
    if(sec.error){setError(sec.error.message);setLoading(false);return;}
    const loadedYears=(yr.data||[]) as AcademicYear[]; setYears(loadedYears); setSections((sec.data||[]) as AcademicSection[]);
    if(structureYearId&&!loadedYears.some(y=>y.id===structureYearId))setParams({});
    setLoading(false);
  }
  useEffect(()=>{loadData();},[school?.id,structureYearId]);

  function openCreateYear(){setEditingYear(null);setYearName("");setStartDate("");setEndDate("");setMakeActive(years.length===0);setError("");setShowYearModal(true);}
  function openEditYear(y:AcademicYear){setEditingYear(y);setYearName(y.name);setStartDate(y.start_date||"");setEndDate(y.end_date||"");setMakeActive(y.is_active);setError("");setShowYearModal(true);}
  function openStructure(y:AcademicYear){setParams({academicYear:y.id});}
  function closeStructure(){setParams({});}

  async function saveYear(){
    if(!school)return; const name=yearName.trim();
    if(!name){setError("Academic year name is required.");return;} if(!startDate||!endDate){setError("Start date and end date are required.");return;} if(endDate<startDate){setError("End date cannot be before the start date.");return;}
    setSaving(true);setError("");
    try{
      if(makeActive){const {error}=await supabase.from("academic_years").update({is_active:false,is_current:false}).eq("school_id",school.id);if(error)throw error;}
      const payload={name,start_date:startDate,end_date:endDate,is_active:makeActive,is_current:makeActive};
      if(editingYear){const {error}=await supabase.from("academic_years").update(payload).eq("id",editingYear.id).eq("school_id",school.id);if(error)throw error;}
      else{
        const {data,error}=await supabase.from("academic_years").insert({school_id:school.id,...payload}).select("id").single(); if(error)throw error;
        if(data){const rows=DEFAULT_SECTIONS.map((name,i)=>({school_id:school.id,academic_year_id:data.id,name,display_order:i+1,is_active:true}));const {error:e}=await supabase.from("academic_sections").insert(rows);if(e)throw e;}
      }
      setShowYearModal(false);await loadData();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save academic year.");}finally{setSaving(false);}
  }
  async function setActiveYear(y:AcademicYear){
    if(!school||y.is_active)return;setSaving(true);setError("");
    try{let r=await supabase.from("academic_years").update({is_active:false,is_current:false}).eq("school_id",school.id);if(r.error)throw r.error;r=await supabase.from("academic_years").update({is_active:true,is_current:true}).eq("id",y.id).eq("school_id",school.id);if(r.error)throw r.error;await loadData();}
    catch(e){setError(e instanceof Error?e.message:"Unable to activate academic year.");}finally{setSaving(false);}
  }
  async function deleteYear(y:AcademicYear){
    if(!school)return;if(y.is_active){setError("Set another academic year active before deleting this year.");return;}
    if(!window.confirm(`Delete academic year "${y.name}"? This can affect records linked to this year.`))return;
    setSaving(true);setError("");try{const {error}=await supabase.from("academic_years").delete().eq("id",y.id).eq("school_id",school.id);if(error)throw error;await loadData();}catch(e){setError(e instanceof Error?e.message:"Unable to delete academic year.");}finally{setSaving(false);}
  }
  function openCreateSection(){if(!structureYear)return;setEditingSection(null);setSectionName("");setSectionOrder(String(structureSections.length+1));setError("");setShowSectionModal(true);}
  function openEditSection(s:AcademicSection){setEditingSection(s);setSectionName(s.name);setSectionOrder(String(s.display_order));setError("");setShowSectionModal(true);}
  async function saveSection(){
    if(!school||!structureYear)return;const name=sectionName.trim();const order=Number(sectionOrder);
    if(!name){setError("Section name is required.");return;}if(!Number.isFinite(order)||order<1){setError("Display order must be a positive number.");return;}
    if(sections.some(s=>s.academic_year_id===structureYear.id&&s.name.toLowerCase()===name.toLowerCase()&&s.id!==editingSection?.id)){setError("A section with this name already exists for this academic year.");return;}
    setSaving(true);setError("");try{
      if(editingSection){const {error}=await supabase.from("academic_sections").update({name,display_order:order}).eq("id",editingSection.id).eq("school_id",school.id);if(error)throw error;}
      else{const {error}=await supabase.from("academic_sections").insert({school_id:school.id,academic_year_id:structureYear.id,name,display_order:order,is_active:true});if(error)throw error;}
      setShowSectionModal(false);await loadData();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save section.");}finally{setSaving(false);}
  }
  async function toggleSection(s:AcademicSection){if(!school)return;setSaving(true);setError("");try{const {error}=await supabase.from("academic_sections").update({is_active:!s.is_active}).eq("id",s.id).eq("school_id",school.id);if(error)throw error;await loadData();}catch(e){setError(e instanceof Error?e.message:"Unable to update section.");}finally{setSaving(false);}}
  async function deleteSection(s:AcademicSection){if(!school)return;if(!window.confirm(`Delete the "${s.name}" section? Classes linked to it may prevent deletion.`))return;setSaving(true);setError("");try{const {error}=await supabase.from("academic_sections").delete().eq("id",s.id).eq("school_id",school.id);if(error)throw error;await loadData();}catch(e){setError(e instanceof Error?e.message:"Unable to delete section.");}finally{setSaving(false);}}

  if(!school)return <div className="mx-auto max-w-[1200px]"><Card className="p-10 text-center text-sm text-slate-500">Select a school to manage academic settings.</Card></div>;

  if(structureYear)return <div className="mx-auto max-w-[1200px]">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><button onClick={closeStructure} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ArrowLeft size={18}/></button><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Academic structure</p><h1 className="mt-1 text-xl font-semibold text-slate-900">{structureYear.name}</h1><p className="mt-1 text-sm text-slate-500">Configure the sections available for this academic year.</p></div></div><Button onClick={openCreateSection}><Plus size={16}/>Add section</Button></div>
    {error&&<ErrorBox error={error} clear={()=>setError("")}/>}<Card className="mb-5"><div className="grid gap-4 p-5 sm:grid-cols-3"><Info label="Academic year" value={structureYear.name}/><Info label="Period" value={`${formatDate(structureYear.start_date)} — ${formatDate(structureYear.end_date)}`}/><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p><p className="mt-1">{structureYear.is_active?<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Check size={12}/>Current</span>:<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Historical</span>}</p></div></div></Card>
    <Card><div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Layers3 size={17}/></div><div><h2 className="text-sm font-semibold text-slate-900">Academic sections</h2><p className="mt-1 text-xs text-slate-500">These sections are used when creating classes for {structureYear.name}.</p></div></div></div>{loading?<div className="p-12 text-center text-sm text-slate-500">Loading sections...</div>:structureSections.length===0?<EmptySections add={openCreateSection}/>:<div className="divide-y divide-slate-100">{structureSections.map(s=><div key={s.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-500">{s.display_order}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{s.name}</h3>{s.is_active?<span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Active</span>:<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Inactive</span>}</div><p className="mt-1 text-xs text-slate-500">Section {s.display_order}</p></div></div><div className="flex flex-wrap gap-2"><SmallButton onClick={()=>openEditSection(s)}><Edit3 size={14}/>Edit</SmallButton><SmallButton onClick={()=>toggleSection(s)} disabled={saving}><Power size={14}/>{s.is_active?"Deactivate":"Activate"}</SmallButton><SmallButton danger onClick={()=>deleteSection(s)} disabled={saving}><Trash2 size={14}/>Delete</SmallButton></div></div>)}</div>}</Card>
    {showSectionModal&&<Modal title={editingSection?"Edit section":"Add section"} subtitle={structureYear.name} close={()=>setShowSectionModal(false)}><Field label="Section name" value={sectionName} onChange={setSectionName} placeholder="e.g. Primary"/><Field label="Display order" value={sectionOrder} onChange={setSectionOrder} type="number" min="1"/><ModalActions saving={saving} cancel={()=>setShowSectionModal(false)} save={saveSection} label={editingSection?"Save changes":"Add section"}/></Modal>}
  </div>;

  return <div className="mx-auto max-w-[1200px]">
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CalendarDays size={19}/></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Settings</p><h1 className="mt-1 text-xl font-semibold text-slate-900">Academic Settings</h1><p className="mt-1 text-sm text-slate-500">Manage academic years and the school structure used across SchoolOS.</p></div></div><Button onClick={openCreateYear}><Plus size={16}/>Add academic year</Button></div>
    {error&&<ErrorBox error={error} clear={()=>setError("")}/>} {activeYear&&<Card className="mb-5"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={17}/></div><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Current academic year</p><div className="mt-0.5 flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-900">{activeYear.name}</h2><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Active</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(activeYear.start_date)} — {formatDate(activeYear.end_date)}</p></div></div><button onClick={()=>openStructure(activeYear)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100">Manage structure<ArrowRight size={15}/></button></div></Card>}
    <Card><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">School academic years</h2><p className="mt-1 text-xs text-slate-500">Previous years remain available for historical records.</p></div>{loading?<div className="p-12 text-center text-sm text-slate-500">Loading academic years...</div>:years.length===0?<div className="p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><CalendarDays size={22}/></div><h3 className="mt-4 text-sm font-semibold text-slate-800">No academic years yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Create an academic year before setting up classes, sections and subjects.</p><Button className="mt-5" onClick={openCreateYear}><Plus size={15}/>Add academic year</Button></div>:<div className="divide-y divide-slate-100">{years.map(y=><div key={y.id} className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{y.name}</h3>{y.is_active?<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><Check size={11}/>Active</span>:<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">Inactive</span>}</div><p className="mt-1 text-xs text-slate-500">{formatDate(y.start_date)}<span className="mx-2 text-slate-300">•</span>{formatDate(y.end_date)}</p></div><div className="flex flex-wrap items-center gap-2">{!y.is_active&&<SmallButton onClick={()=>setActiveYear(y)} disabled={saving}>Set active</SmallButton>}<SmallButton indigo onClick={()=>openStructure(y)}>Manage structure<ArrowRight size={14}/></SmallButton><SmallButton onClick={()=>openEditYear(y)}><Edit3 size={14}/>Edit</SmallButton>{!y.is_active&&<SmallButton danger onClick={()=>deleteYear(y)} disabled={saving}><Trash2 size={14}/>Delete</SmallButton>}</div></div>)}</div>}</Card>
    {showYearModal&&<Modal title={editingYear?"Edit academic year":"Add academic year"} subtitle="Define the academic period used throughout the school." close={()=>setShowYearModal(false)}><Field label="Academic year" value={yearName} onChange={setYearName} placeholder="e.g. 2026–2027"/><div className="grid gap-4 sm:grid-cols-2"><Field label="Start date" value={startDate} onChange={setStartDate} type="date"/><Field label="End date" value={endDate} onChange={setEndDate} type="date"/></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><input type="checkbox" checked={makeActive} onChange={e=>setMakeActive(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300"/><span><span className="block text-sm font-medium text-slate-800">Set as current academic year</span><span className="mt-0.5 block text-xs text-slate-500">This will make all other academic years inactive.</span></span></label><ModalActions saving={saving} cancel={()=>setShowYearModal(false)} save={saveYear} label={editingYear?"Save changes":"Create academic year"}/></Modal>}
  </div>;
}

function Info({label,value}:{label:string;value:string}){return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>}
function ErrorBox({error,clear}:{error:string;clear:()=>void}){return <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3"><p className="text-sm text-red-600">{error}</p><button onClick={clear} className="text-red-400 hover:text-red-600"><X size={16}/></button></div>}
function SmallButton({children,onClick,disabled=false,danger=false,indigo=false}:{children:React.ReactNode;onClick:()=>void;disabled?:boolean;danger?:boolean;indigo?:boolean}){return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${danger?"border-red-100 bg-white text-red-600 hover:bg-red-50":indigo?"border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{children}</button>}
function EmptySections({add}:{add:()=>void}){return <div className="p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Layers3 size={22}/></div><h3 className="mt-4 text-sm font-semibold text-slate-800">No sections yet</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Add sections such as Creche, Nursery, Primary or Lower Secondary.</p><Button className="mt-5" onClick={add}><Plus size={15}/>Add section</Button></div>}
function Modal({title,subtitle,close,children}:{title:string;subtitle:string;close:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button onClick={close} className="text-slate-400 hover:text-slate-700"><X size={18}/></button></div><div className="space-y-4 p-5">{children}</div></div></div>}
function Field({label,value,onChange,placeholder,type="text",min}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;min?:string}){return <div><label className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label><input type={type} value={value} min={min} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"/></div>}
function ModalActions({saving,cancel,save,label}:{saving:boolean;cancel:()=>void;save:()=>void;label:string}){return <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={cancel} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button><Button onClick={save} disabled={saving}>{saving&&<Loader2 size={15} className="animate-spin"/>}{label}</Button></div>}
