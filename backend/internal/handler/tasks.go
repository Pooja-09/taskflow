package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"taskflow/internal/middleware"
	"taskflow/internal/model"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TaskHandler struct {
	db *pgxpool.Pool
}

func NewTaskHandler(db *pgxpool.Pool) *TaskHandler {
	return &TaskHandler{db: db}
}

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	statusFilter := r.URL.Query().Get("status")
	assigneeFilter := r.URL.Query().Get("assignee")

	query := `SELECT id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at
	          FROM tasks WHERE project_id=$1`
	args := []any{projectID}
	if statusFilter != "" {
		args = append(args, statusFilter)
		query += ` AND status=$2`
	}
	if assigneeFilter != "" {
		args = append(args, assigneeFilter)
		if statusFilter != "" {
			query += ` AND assignee_id=$3`
		} else {
			query += ` AND assignee_id=$2`
		}
	}
	query += ` ORDER BY created_at ASC`

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	defer rows.Close()
	tasks := []model.Task{}
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		tasks = append(tasks, t)
	}
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	var exists bool
	h.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM projects WHERE id=$1)`, projectID).Scan(&exists)
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	var req struct {
		Title       string             `json:"title"`
		Description *string            `json:"description"`
		Status      model.TaskStatus   `json:"status"`
		Priority    model.TaskPriority `json:"priority"`
		AssigneeID  *uuid.UUID         `json:"assignee_id"`
		DueDate     *string            `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if req.Title == "" {
		validationError(w, map[string]string{"title": "is required"})
		return
	}
	if req.Status == "" {
		req.Status = model.StatusTodo
	}
	if req.Priority == "" {
		req.Priority = model.PriorityMedium
	}

	var dueDate *time.Time
	if req.DueDate != nil {
		t, err := time.Parse("2006-01-02", *req.DueDate)
		if err == nil {
			dueDate = &t
		}
	}

	var task model.Task
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, due_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at`,
		req.Title, req.Description, req.Status, req.Priority, projectID, req.AssigneeID, dueDate,
	).Scan(&task.ID, &task.Title, &task.Description, &task.Status, &task.Priority,
		&task.ProjectID, &task.AssigneeID, &task.DueDate, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	var existing model.Task
	err = h.db.QueryRow(r.Context(),
		`SELECT id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at
		 FROM tasks WHERE id=$1`, taskID,
	).Scan(&existing.ID, &existing.Title, &existing.Description, &existing.Status, &existing.Priority,
		&existing.ProjectID, &existing.AssigneeID, &existing.DueDate, &existing.CreatedAt, &existing.UpdatedAt)
	if err == pgx.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	var req struct {
		Title       *string            `json:"title"`
		Description *string            `json:"description"`
		Status      *model.TaskStatus  `json:"status"`
		Priority    *model.TaskPriority `json:"priority"`
		AssigneeID  *uuid.UUID         `json:"assignee_id"`
		DueDate     *string            `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	var dueDate *time.Time
	if req.DueDate != nil {
		t, err := time.Parse("2006-01-02", *req.DueDate)
		if err == nil {
			dueDate = &t
		}
	} else {
		dueDate = existing.DueDate
	}

	var task model.Task
	err = h.db.QueryRow(r.Context(),
		`UPDATE tasks SET
		   title = COALESCE($1, title),
		   description = COALESCE($2, description),
		   status = COALESCE($3, status),
		   priority = COALESCE($4, priority),
		   assignee_id = COALESCE($5, assignee_id),
		   due_date = $6,
		   updated_at = NOW()
		 WHERE id=$7
		 RETURNING id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at`,
		req.Title, req.Description, req.Status, req.Priority, req.AssigneeID, dueDate, taskID,
	).Scan(&task.ID, &task.Title, &task.Description, &task.Status, &task.Priority,
		&task.ProjectID, &task.AssigneeID, &task.DueDate, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	var projectID uuid.UUID
	var assigneeID *uuid.UUID
	err = h.db.QueryRow(r.Context(),
		`SELECT project_id, assignee_id FROM tasks WHERE id=$1`, taskID,
	).Scan(&projectID, &assigneeID)
	if err == pgx.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	var ownerID uuid.UUID
	h.db.QueryRow(r.Context(), `SELECT owner_id FROM projects WHERE id=$1`, projectID).Scan(&ownerID)

	isOwner := ownerID == userID
	isAssignee := assigneeID != nil && *assigneeID == userID
	if !isOwner && !isAssignee {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	h.db.Exec(r.Context(), `DELETE FROM tasks WHERE id=$1`, taskID)
	w.WriteHeader(http.StatusNoContent)
}
