import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Task, TaskStatus, TaskPriority } from '../types'

interface TasksResponse { tasks: Task[] }
interface TaskFilters { status?: string; assignee?: string }

export function useTasks(projectId: string, filters?: TaskFilters) {
  return useQuery<TasksResponse>({
    queryKey: ['tasks', projectId, filters],
    queryFn: () => api.get(`/projects/${projectId}/tasks`, { params: filters }).then((r) => r.data),
    enabled: !!projectId,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: Partial<Task> }) =>
      api.post(`/projects/${projectId}/tasks`, data).then((r) => r.data),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

interface UpdateTaskVars {
  id: string
  projectId: string
  data: { title?: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assignee_id?: string; due_date?: string }
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation<Task, Error, UpdateTaskVars>({
    mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data).then((r) => r.data),
    onMutate: async ({ id, projectId, data }) => {
      await qc.cancelQueries({ queryKey: ['project', projectId] })
      const snapshot = qc.getQueryData(['project', projectId])
      qc.setQueryData(['project', projectId], (old: { tasks?: Task[] } | undefined) => {
        if (!old?.tasks) return old
        return { ...old, tasks: old.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)) }
      })
      return { snapshot }
    },
    onError: (_err, { projectId }, context) => {
      if (context && typeof context === 'object' && 'snapshot' in context) {
        qc.setQueryData(['project', projectId], (context as { snapshot: unknown }).snapshot)
      }
    },
    onSettled: (_data, _err, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => api.delete(`/tasks/${id}`),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}
