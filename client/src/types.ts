export type Assignee = {
  id: string;
  name: string;
  email: string;
};

export type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  active?: boolean;
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

export type ProjectWithIssues = Project & {
  issues: (Issue & { assignee?: Assignee | null })[];
};

