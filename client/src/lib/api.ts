import type { Project, User } from "../../src/types";

const API_URL = import.meta.env.VITE_API_URL;

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
        return retryAfterSeconds
          ? `${data.error} Try again in ${retryAfterSeconds} seconds.`
          : data.error;
      }
      if (data && typeof data.message === "string" && data.message.trim()) {
        return retryAfterSeconds
          ? `${data.message} Try again in ${retryAfterSeconds} seconds.`
          : data.message;
      }
    } else {
      const text = await res.text();
      if (text.trim()) {
        return text.trim();
      }
    }
  } catch {
    // ignore parse errors and return fallback
  }
  if (!retryAfterSeconds) {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed) && parsed > 0) {
        retryAfterSeconds = Math.ceil(parsed);
      }
    }
  }
  if (retryAfterSeconds) {
    return `${fallback} Try again in ${retryAfterSeconds} seconds.`;
  }
  return fallback;
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, "Login failed"));
  }

  return res.json(); // { token, user }
}

export async function register(name: string, username: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ name, username, email, password }),
  });

  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, "Registration failed"));
  }

  return res.json(); // { token, user }
}

export async function verifyEmailCode(username: string, code: string) {
  const res = await fetch(`${API_URL}/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ username, code }),
  });

  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, "Email verification failed"));
  }

  return res.json();
}

export async function resendVerificationCode(username: string) {
  const res = await fetch(`${API_URL}/auth/resend-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, "Could not resend verification code"));
  }

  return res.json();
}

export async function refreshSession() {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, "Refresh failed"));
  }

  return res.json(); // { token, user }
}

export async function logoutSession() {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}


export async function createProject(
  name: string,
  description: string,
  ownerId: string | null,
  token: string
): Promise<Project> {
  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      description,
      ownerId,
    }),
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
  const res = await fetch(`${API_URL}/issues`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      projectId,
      title,
      description,
      assigneeId,
      priority,
      status,
    }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to create issue"));

  return res.json();
}

export async function getProjects(token: string): Promise<Project[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to fetch projects"));

  return res.json();
}

export async function getIssuesForProject(projectId: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/project/${projectId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to fetch issues"));

  return res.json();
}

export async function updateProjectName(projectId: string, name: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update project"));

  return res.json();
}

export async function updateProjectOwner(projectId: string, ownerId: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}/owner`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ownerId }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update project owner"));

  return res.json();
}

export async function updateUserName(id: string, name: string, token: string): Promise<User> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update user"));

  return res.json();
}

export async function updateUser(
  id: string,
  updates: { username?: string; name?: string; email?: string; role?: string },
  token: string
): Promise<User> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update user"));

  return res.json();
}

export async function deleteUser(id: string, token: string): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to delete user"));
}

export async function updateUserActive(id: string, active: boolean, token: string): Promise<User> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}/active`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ active }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update user status"));

  return res.json();
}

export async function updateIssueTitle(issueId: string, title: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue title"));

  return res.json();
}

export async function updateIssueDescription(issueId: string, description: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ description }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue description"));

  return res.json();
}

export async function updateIssueAssignee(issueId: string, assigneeId: string | null, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/assignee`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ assigneeId }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update assignee"));

  return res.json();
}

export async function updateIssueStatus(issueId: string, status: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue status"));

  return res.json();
}

export async function updateIssuePriority(issueId: string, priority: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/priority`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ priority }),
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to update issue priority"));

  return res.json();
}

export async function deleteProject(projectId: string, token: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to delete project"));
}

export async function deleteIssue(issueId: string, token: string) {
  const res = await fetch(`${API_URL}/issues/${issueId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(await getApiErrorMessage(res, "Failed to delete issue"));
}
