'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Boxes, Copy, FolderOpen, LoaderCircle, LogOut, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/lib/types';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/components/ToastProvider';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

function projectErrorMessage(error: { code?: string; message: string }) {
  if (error.code === 'PGRST205' || error.code === '42P01' || /could not find the table .*projects|relation .*projects.* does not exist/i.test(error.message)) {
    return 'The projects table has not been created in the Supabase project this site is connected to. In that project, open SQL Editor and run supabase/migrations/0001_init.sql from this repository, then refresh this page.';
  }
  return error.message;
}

export default function Dashboard() {
  const reduceMotion = useReducedMotion();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [user, setUser] = useState('');
  const [db, setDb] = useState<ReturnType<typeof createClient> | null>(null);
  const [action, setAction] = useState('');
  const toast = useToast();

  useEffect(() => {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
      setError('Supabase is not configured. Copy .env.example to .env.local and add the project URL and public key.');
      setLoading(false);
      return;
    }
    setDb(createClient());
  }, []);

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    setError('');
    try {
      const { data: { user: currentUser }, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (!currentUser) { location.assign('/auth/signin'); return; }
      setUser(currentUser.email || 'Student');
      const { data, error: queryError } = await db.from('projects').select('*').order('updated_at', { ascending: false });
      if (queryError) throw queryError;
      setProjects(data || []);
    } catch (caught) {
      const error = caught as { code?: string; message?: string };
      const message = error.message ? projectErrorMessage({ code: error.code, message: error.message }) : 'Could not load your projects. Check your connection and retry.';
      setError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [db, toast]);

  useEffect(() => { void load(); }, [load]);

  async function createProject() {
    if (!db || action) return;
    setAction('create');
    const projectName = name.trim() || 'Untitled project';
    const { data: { user: currentUser }, error: authError } = await db.auth.getUser();
    if (authError || !currentUser) {
      const message = 'Your session expired. Sign in again to create a project.';
      setError(message);
      toast(message, 'error');
      setAction('');
      return;
    }
    const { data, error: insertError } = await db.from('projects').insert({ owner_id: currentUser.id, name: projectName, status: 'draft' }).select().single();
    if (insertError) {
      const message = projectErrorMessage(insertError);
      setError(message);
      toast(message, 'error');
      setAction('');
      return;
    }
    toast('Project created. Opening your workspace…', 'success');
    location.assign(`/dashboard/projects/${data.id}`);
  }

  async function renameProject(project: Project) {
    if (!db || action) return;
    const nextName = window.prompt('Project name', project.name);
    if (!nextName?.trim() || nextName.trim() === project.name) return;
    setAction(`rename-${project.id}`);
    const { error: updateError } = await db.from('projects').update({ name: nextName.trim() }).eq('id', project.id);
    if (updateError) toast(projectErrorMessage(updateError), 'error');
    else { toast('Project renamed.', 'success'); await load(); }
    setAction('');
  }

  async function duplicateProject(project: Project) {
    if (!db || action) return;
    setAction(`duplicate-${project.id}`);
    const { data: { user: currentUser }, error: authError } = await db.auth.getUser();
    if (authError || !currentUser) {
      toast('Your session expired. Sign in again to duplicate a project.', 'error');
      setAction('');
      return;
    }
    const { error: insertError } = await db.from('projects').insert({
      owner_id: currentUser.id,
      name: `${project.name} copy`, description: project.description, status: project.status,
      model_data: project.model_data,
      conversion_settings: project.model_data ? { units: project.model_data.units } : {},
    });
    if (insertError) toast(projectErrorMessage(insertError), 'error');
    else { toast('Project duplicated.', 'success'); await load(); }
    setAction('');
  }

  async function deleteProject(project: Project) {
    if (!db || action || !window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    setAction(`delete-${project.id}`);
    if (project.source_file_path) {
      const { error: storageError } = await db.storage.from('archify-private').remove([project.source_file_path]);
      if (storageError) {
        toast(`Could not remove the private source file: ${storageError.message}`, 'error');
        setAction('');
        return;
      }
    }
    const { error: deleteError } = await db.from('projects').delete().eq('id', project.id);
    if (deleteError) toast(projectErrorMessage(deleteError), 'error');
    else { toast('Project deleted.', 'success'); await load(); }
    setAction('');
  }

  async function signOut() {
    if (!db || action) return;
    setAction('signout');
    const { error: signOutError } = await db.auth.signOut();
    if (signOutError) { toast(signOutError.message, 'error'); setAction(''); return; }
    location.assign('/');
  }

  const shown = useMemo(() => projects
    .filter(project => project.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'created' ? Date.parse(String(b.created_at)) - Date.parse(String(a.created_at))
        : Date.parse(String(b.updated_at)) - Date.parse(String(a.updated_at))), [projects, search, sort]);

  return <motion.main className="wrap dashboard-page" aria-busy={loading} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
    <motion.header className="dashboard-header" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .08, duration: .3 }}>
      <Logo/>
      <div>
        <ThemeToggle/>
        <span className="dashboard-user">{user}</span>
        <button className="btn" onClick={signOut} disabled={!db || !!action} aria-busy={action === 'signout'}>
          {action === 'signout' ? <LoaderCircle size={16} className="loading-spinner"/> : <LogOut size={16}/>} Sign out
        </button>
      </div>
    </motion.header>

    <section className="dashboard-welcome">
      <div><span className="eyebrow">YOUR WORKSPACE</span><h1 className="display">Welcome back</h1><p>Pick up a project or start a new design.</p></div>
      <div className="dashboard-create">
        <input className="input" placeholder="New project name" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void createProject(); }}/>
        <button className="btn primary" onClick={createProject} disabled={!db || !!action} aria-busy={action === 'create'}>
          {action === 'create' ? <LoaderCircle size={16} className="loading-spinner"/> : <Plus size={17}/>} {action === 'create' ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </section>

    <div className="projects-toolbar">
      <h2 className="display">All projects <span>({projects.length})</span></h2>
      <div>
        <select aria-label="Sort projects" className="input" value={sort} onChange={event => setSort(event.target.value)}>
          <option value="updated">Recently updated</option><option value="created">Recently created</option><option value="name">Name</option>
        </select>
        <div><Search size={16}/><input className="input" placeholder="Search projects" value={search} onChange={event => setSearch(event.target.value)}/></div>
      </div>
    </div>

    {error && <div className="dashboard-error" role="alert"><div><b>We couldn’t load your projects</b><p>{error}</p></div><button className="btn" onClick={() => void load()} disabled={loading}>{loading ? <LoaderCircle size={15} className="loading-spinner"/> : <RefreshCw size={15}/>} Retry</button></div>}

    <AnimatePresence mode="wait" initial={false}>
    {loading ? <motion.div key="loading" className="dashboard-loading" role="status" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }}><LoaderCircle className="loading-spinner" size={22}/> Loading your projects…</motion.div>
      : !error && shown.length === 0 ? <motion.div key="empty" className="card dashboard-empty" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0 }}>
        <div className="dashboard-empty-icon"><FolderOpen color="var(--accent)"/></div>
        <h3 className="display">{projects.length ? 'No matching projects' : 'A clean slate'}</h3>
        <p>{projects.length ? 'Try another search.' : 'Create your first project to begin shaping a plan in 3D.'}</p>
        <button className="btn primary" onClick={() => void createProject()} disabled={!db || !!action}><Plus size={16}/> New project</button>
      </motion.div> : !error && <motion.div key="projects" className="project-grid" layout>{shown.map((project, index) => <motion.article layout initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .97 }} transition={{ duration: .28, delay: reduceMotion ? 0 : Math.min(index * .045, .27) }} whileHover={reduceMotion ? undefined : { y: -3 }} className="card project-card" key={project.id}>
        <a href={`/dashboard/projects/${project.id}`} className="project-thumbnail"><div><Boxes size={38} color="var(--accent)" strokeWidth={1.3}/></div></a>
        <div className="project-card-content">
          <div className="project-card-heading"><a href={`/dashboard/projects/${project.id}`}><h3 className="display">{project.name}</h3></a>
            <details className="project-actions"><summary aria-label={`Actions for ${project.name}`}><span>•••</span></summary><div>
              <button onClick={() => void renameProject(project)} disabled={!!action}>Rename</button>
              <button onClick={() => void duplicateProject(project)} disabled={!!action}>{action === `duplicate-${project.id}` ? 'Duplicating…' : <><Copy size={14}/> Duplicate</>}</button>
              <button onClick={() => void deleteProject(project)} disabled={!!action}>{action === `delete-${project.id}` ? 'Deleting…' : <><Trash2 size={14}/> Delete</>}</button>
            </div></details>
          </div>
          <div className="project-card-meta"><span>{project.status}</span><span>Updated {new Date(project.updated_at).toLocaleDateString()}</span></div>
          <a className="project-open" href={`/dashboard/projects/${project.id}`}>Open project <ArrowUpRight size={14}/></a>
        </div>
      </motion.article>)}</motion.div>}
    </AnimatePresence>
    {action && action.startsWith('duplicate-') && <span className="sr-only" role="status">Duplicating project</span>}
  </motion.main>;
}
