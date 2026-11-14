import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isCollaborationConfigured = Boolean(url && anonKey);
export const supabase = isCollaborationConfigured ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  return supabase;
}
export async function signUp(email, password, displayName) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: window.location.href } });
  if (error) throw error;
  return data;
}
export async function signIn(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}
export async function currentUser() {
  const { data, error } = await requireClient().auth.getUser();
  if (error) throw error;
  return data.user;
}
export async function createTeam(name) {
  const { data, error } = await requireClient().rpc('create_mission_team', { p_name: name });
  if (error) throw error;
  return data;
}
export async function createInvite(teamId, role, email) {
  const { data, error } = await requireClient().rpc('create_mission_invite', { p_team_id: teamId, p_role: role, p_email: email });
  if (error) throw error;
  return data;
}
export async function joinTeam(token) {
  const { data, error } = await requireClient().rpc('join_mission_team', { p_token: token });
  if (error) throw error;
  return data;
}
export async function myTeams() {
  const client = requireClient();
  const { data, error } = await client.from('mission_team_members').select('role, team:mission_teams(id,name,owner_id)').order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(x => ({ ...x.team, role: x.role }));
}
export async function loadMission(teamId) {
  const { data, error } = await requireClient().from('mission_designs').select('*').eq('team_id', teamId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveMission(teamId, design) {
  const client = requireClient();
  const { data: userData } = await client.auth.getUser();
  const { data, error } = await client.from('mission_designs').upsert({ team_id: teamId, design, updated_by: userData.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'team_id' }).select().single();
  if (error) throw error;
  return data;
}
export function subscribeMission(teamId, onChange) {
  const client = requireClient();
  const channel = client.channel(`mission-design-${teamId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mission_designs', filter: `team_id=eq.${teamId}` }, payload => onChange(payload.new)).subscribe();
  return () => client.removeChannel(channel);
}

export async function teamMembers(teamId) {
  const { data, error } = await requireClient().from('mission_team_members').select('user_id,role,joined_at,profile:mission_profiles(display_name,email)').eq('team_id', teamId).order('joined_at');
  if (error) throw error;
  return data ?? [];
}
