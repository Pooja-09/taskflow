INSERT INTO users (id, name, email, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test User',
  'test@example.com',
  '$2a$12$MXih1XwnXluraKJ6A1v/LORGPdGJiRa/a84hNKOYmIElGXGqH31C.'
) ON CONFLICT DO NOTHING;

INSERT INTO projects (id, name, description, owner_id)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Demo Project',
  'A sample project for testing',
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id)
VALUES
  (
    '00000000-0000-0000-0000-000000000003',
    'Set up project structure',
    'Initialize repo and configure tooling',
    'done',
    'high',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Build authentication',
    'Implement JWT-based auth',
    'in_progress',
    'high',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Write documentation',
    'Create README and API docs',
    'todo',
    'medium',
    '00000000-0000-0000-0000-000000000002',
    NULL
  )
ON CONFLICT DO NOTHING;
