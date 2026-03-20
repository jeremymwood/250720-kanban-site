import type { Issue, Project, User } from "../../src/types";

const API_URL = import.meta.env.VITE_API_URL;
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

type DemoState = {
  users: User[];
  projects: Array<Project & { issues: Issue[] }>;
};

const DEMO_STATE_KEY = "ishi-demo-state-v1";
const DEMO_SESSION_KEY = "ishi-demo-session-user-id";
const DEMO_PASSWORD = "Password123";

function nowIso() {
  return new Date().toISOString();
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function issue(
  id: string,
  title: string,
  status: string,
  priority: string,
  description: string,
  assignee: User | null
): Issue {
  const now = nowIso();
  return {
    id,
    title,
    status,
    priority,
    description,
    createdAt: now,
    updatedAt: now,
    assignee: assignee
      ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email,
        }
      : null,
  };
}

function createInitialDemoState(): DemoState {
  const users: User[] = [
    { id: "u-admin", username: "alex", name: "Alex Mercer", email: "alex@example.com", role: "ADMIN", active: true },
    { id: "u-dev-1", username: "niko", name: "Niko Alvarez", email: "niko@example.com", role: "DEVELOPER", active: true },
    { id: "u-dev-2", username: "priya", name: "Priya Patel", email: "priya@example.com", role: "DEVELOPER", active: true },
    { id: "u-dev-3", username: "marcus", name: "Marcus Reed", email: "marcus@example.com", role: "DEVELOPER", active: true },
    { id: "u-client-1", username: "claire", name: "Claire Bennett", email: "claire@example.com", role: "CLIENT", active: true },
    { id: "u-client-2", username: "owen", name: "Owen Brooks", email: "owen@example.com", role: "CLIENT", active: true },
    { id: "u-client-3", username: "maya", name: "Maya Chen", email: "maya@example.com", role: "CLIENT", active: true },
  ];

  const byUsername = Object.fromEntries(users.map((u) => [u.username, u]));
  const now = nowIso();

  return {
    users,
    projects: [
      {
        id: "p-1",
        name: "Ishi Board Platform",
        description: "Core web experience, role controls, and board interactions",
        createdAt: now,
        updatedAt: now,
        owner: { id: byUsername.alex.id, name: byUsername.alex.name, email: byUsername.alex.email },
        issues: [
          issue("i-1", "Refine Session Recovery", "NEW", "MEDIUM", "Align retry and timeout boundaries across auth flows.", byUsername.niko),
          issue("i-2", "Harden Permission Checks", "COMMITTED", "HIGH", "Review policy gates for role-based editing.", byUsername.priya),
          issue("i-3", "Polish Form Validation", "IN_PROGRESS", "LOW", "Unify validation messaging in modal forms.", byUsername.marcus),
          issue("i-4", "Stabilize Error Handling", "QA", "URGENT", "Verify 429 handling and Retry-After messaging.", byUsername.niko),
          issue("i-5", "Coordinate Release Readiness", "DONE", "MEDIUM", "Finalize pre-release readiness checklist.", byUsername.priya),
        ],
      },
      {
        id: "p-2",
        name: "Client Portal Refresh",
        description: "Client-facing dashboard and issue visibility improvements",
        createdAt: now,
        updatedAt: now,
        owner: { id: byUsername.priya.id, name: byUsername.priya.name, email: byUsername.priya.email },
        issues: [
          issue("i-6", "Streamline Search Experience", "NEW", "LOW", "Keep quick-search controls compact in header.", byUsername.marcus),
          issue("i-7", "Improve Modal Accessibility", "COMMITTED", "MEDIUM", "Ensure Escape and click-outside behavior is consistent.", byUsername.niko),
          issue("i-8", "Finalize Notification Messaging", "IN_PROGRESS", "HIGH", "Polish success/error copy for critical actions.", byUsername.priya),
          issue("i-9", "Validate Response Contracts", "QA", "MEDIUM", "Confirm all error payload shapes in client handling.", byUsername.marcus),
          issue("i-10", "Optimize Data Consistency", "DONE", "LOW", "Normalize rendered project owner metadata.", byUsername.niko),
        ],
      },
      {
        id: "p-3",
        name: "Identity and Access",
        description: "Auth workflows, verification, and session handling",
        createdAt: now,
        updatedAt: now,
        owner: { id: byUsername.alex.id, name: byUsername.alex.name, email: byUsername.alex.email },
        issues: [
          issue("i-11", "Tune Input Sanitization", "NEW", "HIGH", "Run sanitization checks across comment and issue inputs.", byUsername.priya),
          issue("i-12", "Audit Request Lifecycle", "COMMITTED", "URGENT", "Verify token rotation and revoke-on-reuse logic.", byUsername.niko),
          issue("i-13", "Align Header Navigation", "IN_PROGRESS", "MEDIUM", "Improve utility discoverability in compact mode.", byUsername.marcus),
          issue("i-14", "Standardize Telemetry Hooks", "QA", "LOW", "Emit consistent request IDs in API responses.", byUsername.priya),
          issue("i-15", "Coordinate Session Recovery", "DONE", "MEDIUM", "Complete idle timeout and refresh fallback checks.", byUsername.niko),
        ],
      },
      {
        id: "p-4",
        name: "Operational Insights",
        description: "Health checks, diagnostics, and deployment reliability",
        createdAt: now,
        updatedAt: now,
        owner: { id: byUsername.marcus.id, name: byUsername.marcus.name, email: byUsername.marcus.email },
        issues: [
          issue("i-16", "Clarify Health Probe Semantics", "NEW", "LOW", "Distinguish liveness and readiness behavior.", byUsername.niko),
          issue("i-17", "Refine Build Gate Reporting", "COMMITTED", "MEDIUM", "Surface CI failures with actionable details.", byUsername.priya),
          issue("i-18", "Harden Deployment Rollbacks", "IN_PROGRESS", "HIGH", "Define deterministic rollback validation steps.", byUsername.marcus),
          issue("i-19", "Improve Runbook Coverage", "QA", "MEDIUM", "Expand docs for operational recovery workflows.", byUsername.niko),
          issue("i-20", "Finalize Release Checklist", "DONE", "LOW", "Capture final pre-deploy verification items.", byUsername.priya),
        ],
      },
    ],
  };
}

function readDemoState(): DemoState {
  const raw = localStorage.getItem(DEMO_STATE_KEY);
  if (!raw) {
    const initial = createInitialDemoState();
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(initial));
    return deepClone(initial);
  }
  try {
    return JSON.parse(raw) as DemoState;
  } catch {
    const initial = createInitialDemoState();
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(initial));
    return deepClone(initial);
  }
}

function writeDemoState(state: DemoState) {
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
}

function nextId(prefix: string, existing: string[]) {
  let i = existing.length + 1;
  while (existing.includes(`${prefix}-${i}`)) i += 1;
  return `${prefix}-${i}`;
}

async function getApiErrorMessage(res: Response, fallback: string): Promise<string> {
  let retryAfterSeconds: number | undefined;
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data && typeof data.retryAfterSeconds === "number" && Number.isFinite(data.retryAfterSeconds)) {
        retryAfterSeconds = Math.max(Math.ceil(data.retryAfterSeconds), 1);
      }
      if (data && typeof data.error === "string" && data.error.trim()) {
        return retryAfterSeconds ? `${data.error} Try again in ${retryAfterSeconds} seconds.` : data.error;
      }
      if (data && typeof data.message === "string" && data.message.trim()) {
        return retryAfterSeconds ? `${data.message} Try again in ${retryAfterSeconds} seconds.` : data.message;
      }
    } else {
      const text = await res.text();
      if (text.trim()) return text.trim();
    }
  } catch {
    // ignore parse errors and return fallback
  }
  if (!retryAfterSeconds) {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed) && parsed > 0) retryAfterSeconds = Math.ceil(parsed);
    }
  }
  if (retryAfterSeconds) return `${fallback} Try again in ${retryAfterSeconds} seconds.`;
  return fallback;
}

export async function login(username: string, password: string) {
  if (DEMO_MODE) {
    const state = readDemoState();
    const user = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || password !== DEMO_PASSWORD) throw new Error("Login failed");
    if (user.active === false) throw new Error("Account is inactive.");
    localStorage.setItem(DEMO_SESSION_KEY, user.id);
    return { token: "demo-token", user };
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Login failed"));
  return res.json();
}

export async function register(name: string, username: string, email: string, password: string) {
  if (DEMO_MODE) {
    const state = readDemoState();
    if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error("Username already exists");
    }
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const newUser: User = {
      id: nextId("u-client", state.users.map((u) => u.id)),
      username,
      name,
      email,
      role: "CLIENT",
      active: true,
    };
    state.users.push(newUser);
    writeDemoState(state);
    return { token: "demo-token", user: newUser };
  }

  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, username, email, password }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Registration failed"));
  return res.json();
}

export async function verifyEmailCode(username: string, code: string) {
  if (DEMO_MODE) return { verified: true, username, code };
  const res = await fetch(`${API_URL}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, code }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Email verification failed"));
  return res.json();
}

export async function resendVerificationCode(username: string) {
  if (DEMO_MODE) return { sent: true, username };
  const res = await fetch(`${API_URL}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Could not resend verification code"));
  return res.json();
}

export async function refreshSession() {
  if (DEMO_MODE) {
    const state = readDemoState();
    const sessionUserId = localStorage.getItem(DEMO_SESSION_KEY) ?? "u-admin";
    const user = state.users.find((u) => u.id === sessionUserId) ?? state.users[0];
    if (!user) throw new Error("No demo users available.");
    localStorage.setItem(DEMO_SESSION_KEY, user.id);
    return { token: "demo-token", user };
  }

  const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Refresh failed"));
  return res.json();
}

export async function logoutSession() {
  if (DEMO_MODE) {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return;
  }
  await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
}

export async function createProject(name: string, description: string, ownerId: string | null, token: string): Promise<Project> {
  if (DEMO_MODE) {
    const state = readDemoState();
    const now = nowIso();
    const owner = ownerId ? state.users.find((u) => u.id === ownerId) ?? null : null;
    const project: Project & { issues: Issue[] } = {
      id: nextId("p", state.projects.map((p) => p.id)),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
      issues: [],
    };
    state.projects.push(project);
    writeDemoState(state);
    return deepClone(project);
  }

  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, description, ownerId }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to create project"));
  return res.json();
}

export async function createIssue(
  token: string,
  projectId: string,
  title: string,
  description: string,
  assigneeId: string | null,
  priority: string,
  status: string
) {
  if (DEMO_MODE) {
    const state = readDemoState();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Project not found");
    const assignee = assigneeId ? state.users.find((u) => u.id === assigneeId) ?? null : null;
    const created = issue(
      nextId("i", state.projects.flatMap((p) => p.issues.map((x) => x.id))),
      title,
      status,
      priority,
      description,
      assignee
    );
    project.issues.push(created);
    project.updatedAt = nowIso();
    writeDemoState(state);
    return deepClone(created);
  }

  const res = await fetch(`${API_URL}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, title, description, assigneeId, priority, status }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to create issue"));
  return res.json();
}

export async function getUsers(token: string): Promise<User[]> {
  if (DEMO_MODE) return readDemoState().users;
  const res = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to fetch users"));
  return res.json();
}

export async function getProjects(token: string): Promise<Project[]> {
  if (DEMO_MODE) {
    const state = readDemoState();
    return state.projects.map(({ issues, ...project }) => deepClone(project));
  }
  const res = await fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to fetch projects"));
  return res.json();
}

export async function getIssuesForProject(projectId: string, token: string) {
  if (DEMO_MODE) {
    const project = readDemoState().projects.find((p) => p.id === projectId);
    return deepClone(project?.issues ?? []);
  }
  const res = await fetch(`${API_URL}/issues/project/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to fetch issues"));
  return res.json();
}

export async function updateProjectName(projectId: string, name: string, token: string) {
  if (DEMO_MODE) {
    const state = readDemoState();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Project not found");
    project.name = name;
    project.updatedAt = nowIso();
    writeDemoState(state);
    return deepClone(project);
  }
  const res = await fetch(`${API_URL}/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update project"));
  return res.json();
}

export async function updateProjectOwner(projectId: string, ownerId: string, token: string) {
  if (DEMO_MODE) {
    const state = readDemoState();
    const project = state.projects.find((p) => p.id === projectId);
    const owner = state.users.find((u) => u.id === ownerId);
    if (!project || !owner) throw new Error("Project or owner not found");
    project.owner = { id: owner.id, name: owner.name, email: owner.email };
    project.updatedAt = nowIso();
    writeDemoState(state);
    return deepClone(project);
  }
  const res = await fetch(`${API_URL}/projects/${projectId}/owner`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ownerId }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update project owner"));
  return res.json();
}

export async function updateUserName(id: string, name: string, token: string): Promise<User> {
  return updateUser(id, { name }, token);
}

export async function updateUser(id: string, updates: { username?: string; name?: string; email?: string; role?: string }, token: string): Promise<User> {
  if (DEMO_MODE) {
    const state = readDemoState();
    const user = state.users.find((u) => u.id === id);
    if (!user) throw new Error("User not found");
    Object.assign(user, updates);

    for (const project of state.projects) {
      if (project.owner?.id === user.id) {
        project.owner = { id: user.id, name: user.name, email: user.email };
      }
      for (const issue of project.issues) {
        if (issue.assignee?.id === user.id) {
          issue.assignee = { id: user.id, name: user.name, email: user.email };
        }
      }
    }

    writeDemoState(state);
    return deepClone(user);
  }

  const res = await fetch(`${API_URL}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update user"));
  return res.json();
}

export async function deleteUser(id: string, token: string): Promise<void> {
  if (DEMO_MODE) {
    const state = readDemoState();
    state.users = state.users.filter((u) => u.id !== id);
    for (const project of state.projects) {
      if (project.owner?.id === id) project.owner = null;
      for (const issue of project.issues) {
        if (issue.assignee?.id === id) issue.assignee = null;
      }
    }
    writeDemoState(state);
    return;
  }

  const res = await fetch(`${API_URL}/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to delete user"));
}

export async function updateUserActive(id: string, active: boolean, token: string): Promise<User> {
  if (DEMO_MODE) {
    const state = readDemoState();
    const user = state.users.find((u) => u.id === id);
    if (!user) throw new Error("User not found");
    user.active = active;
    writeDemoState(state);
    return deepClone(user);
  }
  const res = await fetch(`${API_URL}/users/${id}/active`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update user status"));
  return res.json();
}

function updateIssueInDemo(
  issueId: string,
  updater: (issue: Issue, state: DemoState) => void
): Issue {
  const state = readDemoState();
  for (const project of state.projects) {
    const issue = project.issues.find((i) => i.id === issueId);
    if (issue) {
      updater(issue, state);
      issue.updatedAt = nowIso();
      project.updatedAt = nowIso();
      writeDemoState(state);
      return deepClone(issue);
    }
  }
  throw new Error("Issue not found");
}

export async function updateIssueTitle(issueId: string, title: string, token: string) {
  if (DEMO_MODE) return updateIssueInDemo(issueId, (issue) => void (issue.title = title));
  const res = await fetch(`${API_URL}/issues/${issueId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue title"));
  return res.json();
}

export async function updateIssueDescription(issueId: string, description: string, token: string) {
  if (DEMO_MODE) return updateIssueInDemo(issueId, (issue) => void (issue.description = description));
  const res = await fetch(`${API_URL}/issues/${issueId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue description"));
  return res.json();
}

export async function updateIssueAssignee(issueId: string, assigneeId: string | null, token: string) {
  if (DEMO_MODE) {
    return updateIssueInDemo(issueId, (issue, state) => {
      const assignee = assigneeId ? state.users.find((u) => u.id === assigneeId) ?? null : null;
      issue.assignee = assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null;
    });
  }
  const res = await fetch(`${API_URL}/issues/${issueId}/assignee`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assigneeId }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update assignee"));
  return res.json();
}

export async function updateIssueStatus(issueId: string, status: string, token: string) {
  if (DEMO_MODE) return updateIssueInDemo(issueId, (issue) => void (issue.status = status));
  const res = await fetch(`${API_URL}/issues/${issueId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue status"));
  return res.json();
}

export async function updateIssuePriority(issueId: string, priority: string, token: string) {
  if (DEMO_MODE) return updateIssueInDemo(issueId, (issue) => void (issue.priority = priority));
  const res = await fetch(`${API_URL}/issues/${issueId}/priority`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ priority }),
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue priority"));
  return res.json();
}

export async function deleteProject(projectId: string, token: string) {
  if (DEMO_MODE) {
    const state = readDemoState();
    state.projects = state.projects.filter((p) => p.id !== projectId);
    writeDemoState(state);
    return;
  }
  const res = await fetch(`${API_URL}/projects/${projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to delete project"));
}

export async function deleteIssue(issueId: string, token: string) {
  if (DEMO_MODE) {
    const state = readDemoState();
    for (const project of state.projects) {
      const before = project.issues.length;
      project.issues = project.issues.filter((i) => i.id !== issueId);
      if (project.issues.length !== before) {
        writeDemoState(state);
        return;
      }
    }
    throw new Error("Issue not found");
  }
  const res = await fetch(`${API_URL}/issues/${issueId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to delete issue"));
}

