package handler

import (
	"encoding/json"
	"net/http"

	"taskflow/internal/middleware"
	"taskflow/internal/model"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProjectHandler struct {
	db *pgxpool.Pool
}

func NewProjectHandler(db *pgxpool.Pool) *ProjectHandler {
	return &ProjectHandler{db: db}
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	rows, err := h.db.Query(r.Context(),
		`SELECT DISTINCT p.id, p.name, p.description, p.owner_id, p.created_at
		 FROM projects p
		 LEFT JOIN tasks t ON t.project_id = p.id
		 WHERE p.owner_id = $1 OR t.assignee_id = $1
		 ORDER BY p.created_at DESC`, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	defer rows.Close()
	projects := []model.Project{}
	for rows.Next() {
		var p model.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt); err != nil {
			continue
		}
		projects = append(projects, p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if req.Name == "" {
		validationError(w, map[string]string{"name": "is required"})
		return
	}
	var p model.Project
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3)
		 RETURNING id, name, description, owner_id, created_at`,
		req.Name, req.Description, userID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	var p model.Project
	err = h.db.QueryRow(r.Context(),
		`SELECT id, name, description, owner_id, created_at FROM projects WHERE id=$1`, id,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err == pgx.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	rows, err := h.db.Query(r.Context(),
		`SELECT id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at
		 FROM tasks WHERE project_id=$1 ORDER BY created_at ASC`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	defer rows.Close()
	p.Tasks = []model.Task{}
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		p.Tasks = append(p.Tasks, t)
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	var ownerID uuid.UUID
	err = h.db.QueryRow(r.Context(), `SELECT owner_id FROM projects WHERE id=$1`, id).Scan(&ownerID)
	if err == pgx.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if ownerID != userID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	var p model.Project
	err = h.db.QueryRow(r.Context(),
		`UPDATE projects SET
		   name = COALESCE($1, name),
		   description = COALESCE($2, description)
		 WHERE id=$3
		 RETURNING id, name, description, owner_id, created_at`,
		req.Name, req.Description, id,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	var ownerID uuid.UUID
	err = h.db.QueryRow(r.Context(), `SELECT owner_id FROM projects WHERE id=$1`, id).Scan(&ownerID)
	if err == pgx.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if ownerID != userID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	// tasks deleted via ON DELETE CASCADE
	h.db.Exec(r.Context(), `DELETE FROM projects WHERE id=$1`, id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectHandler) Stats(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	var exists bool
	h.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM projects WHERE id=$1)`, id).Scan(&exists)
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	byStatus := map[string]int{"todo": 0, "in_progress": 0, "done": 0}
	rows, err := h.db.Query(r.Context(),
		`SELECT status, COUNT(*) FROM tasks WHERE project_id=$1 GROUP BY status`, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int
			rows.Scan(&status, &count)
			byStatus[status] = count
		}
	}

	type assigneeStat struct {
		AssigneeID *uuid.UUID `json:"assignee_id"`
		Count      int        `json:"count"`
	}
	byAssignee := []assigneeStat{}
	arows, err := h.db.Query(r.Context(),
		`SELECT assignee_id, COUNT(*) FROM tasks WHERE project_id=$1 GROUP BY assignee_id`, id)
	if err == nil {
		defer arows.Close()
		for arows.Next() {
			var s assigneeStat
			arows.Scan(&s.AssigneeID, &s.Count)
			byAssignee = append(byAssignee, s)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"by_status":   byStatus,
		"by_assignee": byAssignee,
	})
}
