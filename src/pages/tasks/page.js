
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { CheckSquare, Clock, AlertCircle, Plus, Calendar } from 'lucide-react';
import styles from './tasks.module.css';
import Modal from '@/components/Modal';

export default function TasksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium'
  });

  useEffect(() => {
    if (user) loadTasks();
    
    const channel = supabase.channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks();
      }).subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [user]);

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, leads(full_name)')
        .eq('assigned_to', user.id)
        .order('due_date', { ascending: true });
        
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title) return toast.warning('Title is required');
    try {
      const { error } = await supabase.from('tasks').insert({
        ...form,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assigned_to: user.id,
        created_by: user.id
      });
      if (error) throw error;
      toast.success('Task created');
      setModalOpen(false);
      setForm({ title: '', description: '', due_date: '', priority: 'medium' });
      loadTasks();
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
      if (error) throw error;
    } catch (err) {
      toast.error('Failed to update task');
      loadTasks();
    }
  };

  const deleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;
    try {
      await supabase.from('tasks').delete().eq('id', id);
      toast.success('Task deleted');
      loadTasks();
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>My Tasks</h1>
          <p className="text-muted">Manage your daily to-dos and priorities</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Task
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div className={styles.content}>
          <div className={styles.section}>
            <h3>Pending ({pendingTasks.length})</h3>
            {pendingTasks.length === 0 ? (
              <p className="text-muted">No pending tasks. Great job!</p>
            ) : (
              <div className={styles.taskList}>
                {pendingTasks.map(task => (
                  <TaskCard key={task.id} task={task} onToggle={() => toggleStatus(task)} onDelete={() => deleteTask(task.id)} />
                ))}
              </div>
            )}
          </div>
          
          {doneTasks.length > 0 && (
            <div className={styles.section} style={{ opacity: 0.7 }}>
              <h3>Completed ({doneTasks.length})</h3>
              <div className={styles.taskList}>
                {doneTasks.map(task => (
                  <TaskCard key={task.id} task={task} onToggle={() => toggleStatus(task)} onDelete={() => deleteTask(task.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Task" footer={
        <>
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Task</button>
        </>
      }>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="What needs to be done?" />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input type="datetime-local" className="form-input" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete }) {
  const isDone = task.status === 'done';
  const isOverdue = !isDone && task.due_date && new Date(task.due_date) < new Date();
  
  return (
    <div className={`${styles.taskCard} ${isDone ? styles.done : ''}`}>
      <div className={styles.checkbox} onClick={onToggle}>
        {isDone ? <CheckSquare size={20} color="var(--success)" /> : <div className={styles.checkEmpty} />}
      </div>
      <div className={styles.taskBody}>
        <div className={styles.taskTitle}>{task.title}</div>
        {task.description && <div className={styles.taskDesc}>{task.description}</div>}
        <div className={styles.taskMeta}>
          {task.due_date && (
            <span className={isOverdue ? styles.overdue : ''}>
              <Calendar size={12} style={{ marginRight: 4 }} />
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
          {task.leads && <span>👤 {task.leads.full_name}</span>}
          <span className={`badge badge-priority-${task.priority}`}>{task.priority}</span>
        </div>
      </div>
      <button className="btn btn-ghost btn-sm text-danger" onClick={onDelete} title="Delete">🗑️</button>
    </div>
  );
}
