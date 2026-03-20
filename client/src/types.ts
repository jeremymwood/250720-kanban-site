import type { Project as BaseProject, Issue as BaseIssue, User as BaseUser } from "./types";

export type Assignee = {
  id: string;
  name: string;
  email: string;
};

export type ProjectWithIssues = BaseProject & {
  issues: (BaseIssue & { assignee?: Assignee | null })[];
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type Issue = {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
  assignee?: Assignee | null;
};

export type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  active?: boolean;
};
