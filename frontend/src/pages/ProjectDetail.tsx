import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import TaskModal from '../components/TaskModal'
import { useProject, useUpdateProject, useDeleteProject } from '../hooks/useProjects'
import { useUpdateTask, useDeleteTask } from '../hooks/useTasks'
import { useAuth } from '../context/AuthContext'
import type { Task, TaskStatus } from '../types'

const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'Todo', in_progress: 'In Progress', done: 'Done' }
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  done: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
}
const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
}
const PRIORITY_COLORS = {
  low: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
  medium: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
  high: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
}
const STATUS_CYCLE: TaskStatus[] = ['todo', 'in_progress', 'done']

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse flex gap-4">
          <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: project, isLoading, isError } = useProject(id!)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task }>({ open: false })
  const [editProject, setEditProject] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8"><Skeleton /></main>
    </div>
  )

  if (isError || !project) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-gray-500 dark:text-gray-400">Failed to load project.</p>
        <button onClick={() => navigate('/projects')} className="mt-3 text-sm text-indigo-600 hover:underline">Back to projects</button>
      </div>
    </div>
  )

  const isOwner = user?.id === project.owner_id
  const tasks = project.tasks ?? []
  const filtered = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter)

  const statusCounts = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }

  const cycleStatus = (task: Task) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]
    updateTask.mutate({ id: task.id, data: { status: next }, projectId: id! })
  }

  const handleDeleteTask = (taskId: string) => {
    if (confirm('Delete this task?')) deleteTask.mutate({ id: taskId, projectId: id! })
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateProject.mutateAsync({ id: id!, data: editForm })
    setEditProject(false)
  }

  const handleDeleteProject = async () => {
    await deleteProject.mutateAsync(id!)
    navigate('/projects')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Project Header */}
        {editProject ? (
          <form onSubmit={handleSaveProject} className="mb-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
            <input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Description (optional)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={updateProject.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition">Save</button>
              <button type="button" onClick={() => setEditProject(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                {project.description && (
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm leading-relaxed">{project.description}</p>
                )}
              </div>
              {isOwner && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditForm({ name: project.name, description: project.description ?? '' }); setEditProject(true) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-red-200 dark:border-red-900 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex gap-3 mt-4 flex-wrap">
              {(Object.entries(statusCounts) as [TaskStatus, number][]).map(([s, count]) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                    statusFilter === s
                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                  {STATUS_LABELS[s]} · {count}
                </button>
              ))}
              {statusFilter !== 'all' && (
                <button onClick={() => setStatusFilter('all')} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 transition">
                  Clear filter ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tasks header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Tasks {statusFilter !== 'all' && `· ${STATUS_LABELS[statusFilter as TaskStatus]}`}
            <span className="ml-2 text-gray-400 dark:text-gray-600 normal-case font-normal">({filtered.length})</span>
          </h2>
          <button
            onClick={() => setTaskModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-indigo-500/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>

        {/* Task list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">No tasks yet. Add your first task!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <div
                key={task.id}
                className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3.5 flex items-center gap-3 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition"
              >
                {/* Status dot / cycle button */}
                <button
                  onClick={() => cycleStatus(task)}
                  title="Click to advance status"
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition hover:scale-110 ${
                    task.status === 'done'
                      ? 'bg-emerald-500 border-emerald-500'
                      : task.status === 'in_progress'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                  }`}
                >
                  {task.status === 'done' && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {task.status === 'in_progress' && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition truncate ${
                      task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                    }`}
                    onClick={() => setTaskModal({ open: true, task })}
                  >
                    {task.title}
                  </p>
                  {task.due_date && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority}
                  </span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {taskModal.open && (
        <TaskModal projectId={id!} task={taskModal.task} onClose={() => setTaskModal({ open: false })} />
      )}

      {/* Delete project confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Delete Project?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">This will permanently delete <strong className="text-gray-700 dark:text-gray-300">{project.name}</strong> and all its tasks.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition">Cancel</button>
              <button
                onClick={handleDeleteProject}
                disabled={deleteProject.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition"
              >
                {deleteProject.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
