// Creates one un-confirmed allocation so the organization-side confirmation
// can be driven through the real interface.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').map(l=>{const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);return m?[m[1],m[2].trim()]:null;}).filter(Boolean));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: auth, error: e0 } = await sb.auth.signInWithPassword({ email: 'donor.aarav.demo@rehome.test', password: 'Demo@12345' });
if (e0) throw e0;

const { data: reqs } = await sb.from('requirements').select('*').eq('item_type','Notebook').in('status',['open','partially_fulfilled']);
const target = (reqs ?? [])[0];
if (!target) throw new Error('no Notebook requirement visible');

let { data: item } = await sb.from('items').select('*').eq('owner_id', auth.user.id).eq('item_type','Notebook').order('created_at', { ascending: false }).limit(1).maybeSingle();
if (!item) {
  const r = await sb.from('items').insert({
    owner_id: auth.user.id, category:'Education', subcategory:'Stationery', item_type:'Notebook',
    condition:'Good', reusability:'High', reusability_score:82, destination_path:'Direct reuse / donation',
    location:'Vellore, Tamil Nadu', latitude:12.92, longitude:79.13, quantity:12,
    ai_source:'manual', user_corrected:true, status:'listed',
  }).select('*').single();
  if (r.error) throw r.error;
  item = r.data;
}

const { data: existing } = await sb.from('match_allocations').select('id,status').eq('item_id', item.id).not('status','in','(cancelled)');
const live = (existing ?? []).find(a => a.status !== 'confirmed');
if (live) { console.log('pending allocation already exists:', live.id, live.status); process.exit(0); }

// Earlier runs may already have spent this item. The database tracks that on
// items.quantity_allocated and refuses to over-allocate ("Only N of this item
// remain unallocated"), so ask for what is actually left and start a fresh
// item when nothing is.
let remaining = (item.quantity ?? 0) - (item.quantity_allocated ?? 0);

if (remaining <= 0) {
  const r = await sb.from('items').insert({
    owner_id: auth.user.id, category:'Education', subcategory:'Stationery', item_type:'Notebook',
    condition:'Good', reusability:'High', reusability_score:82, destination_path:'Direct reuse / donation',
    location:'Vellore, Tamil Nadu', latitude:12.92, longitude:79.13, quantity:12,
    ai_source:'manual', user_corrected:true, status:'listed',
  }).select('*').single();
  if (r.error) throw r.error;
  item = r.data;
  remaining = item.quantity;
  console.log('previous item fully allocated; created a fresh one:', item.id);
}

const { data: alloc, error } = await sb.rpc('allocate_to_requirement', {
  p_item_id: item.id, p_requirement_id: target.id, p_quantity: Math.min(remaining, 12), p_match_id: null,
});
if (error) throw error;
const a = Array.isArray(alloc) ? alloc[0] : alloc;
await sb.rpc('schedule_handoff', { p_allocation_id: a.id, p_scheduled_for: new Date(Date.now()+3600e3).toISOString(), p_location: 'School reception', p_notes: null });
await sb.rpc('mark_handed_over', { p_allocation_id: a.id });
console.log('pending allocation ready:', a.id, '→ org', a.organization_id);
