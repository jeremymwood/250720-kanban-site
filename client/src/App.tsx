import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
//import "./App.css";
import Board from "./components/Board";
import Login from "./components/Login";
import AppHeader from "./components/AppHeader";
import AppFooter from "./components/AppFooter";
import {
  createProject,
  createIssue,
  getUsers,
  getProjects,
  getIssuesForProject,
  updateUser,
  updateUserActive,
  deleteUser,
  updateIssueTitle,
  updateIssueAssignee,
  updateIssueStatus,
  updateIssuePriority,
  updateIssueDescription,
  deleteProject,
  deleteIssue,
  resetDemoState,
  refreshSession,
  logoutSession
} from "./lib/api";
import type { ProjectWithIssues, Issue, User } from "../src/types";

function App() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [authInitializing, setAuthInitializing] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);  
  const [projects, setProjects] = useState<ProjectWithIssues[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [issuesByProject, setIssuesByProject] = useState<Record<string, Issue[]>>({});
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userEditDrafts, setUserEditDrafts] = useState<
    Record<string, { username: string; name: string; email: string; role: string; active: boolean }>
  >({});
  const [accountDraft, setAccountDraft] = useState({
    username: "",
    name: "",
    email: "",
    role: "",
  });
  const roleOptions = ["ADMIN", "DEVELOPER", "CLIENT"];
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: (() => Promise<void> | void) | null;
  }>({ open: false, message: "", onConfirm: null });
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });
  const statuses = ["NEW", "COMMITTED", "IN_PROGRESS", "QA", "DONE"] as const;
  const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectOwnerId, setNewProjectOwnerId] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<
    | "projectName"
    | "projectCreatedAt"
    | "issueTitle"
    | "issueCreatedAt"
    | "issuePriority"
    | "projectAssignee"
    | "issueAssignee"
  >("projectName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [utilitiesModalOpen, setUtilitiesModalOpen] = useState(false);
  const [filterProjectIds, setFilterProjectIds] = useState<string[]>([]);
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [utilitiesSnapshot, setUtilitiesSnapshot] = useState<{
    sortBy: typeof sortBy;
    sortDir: typeof sortDir;
    filterProjectIds: string[];
    filterAssigneeIds: string[];
    filterPriorities: string[];
  } | null>(null);
  const [hasBoardScrollbar, setHasBoardScrollbar] = useState(false);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const [newIssues, setNewIssues] = useState<Record<string, {
    title: string;
    description: string;
    assigneeId: string;
    priority: string;
    status: string;
  }>>({});
  const [issueModalProjectId, setIssueModalProjectId] = useState<string | null>(null);
  const [issueDetail, setIssueDetail] = useState<{
    projectId: string;
    projectName: string;
    issueId: string;
    original: Issue;
    draft: {
      title: string;
      description: string;
      priority: string;
      status: string;
      assigneeId: string;
    };
  } | null>(null);
  const [showIssueComments, setShowIssueComments] = useState(false);
  const [issueCommentDrafts, setIssueCommentDrafts] = useState<Record<string, string>>({});
  const [issueCommentsById, setIssueCommentsById] = useState<
    Record<string, { text: string; author: string; createdAt: string }[]>
  >({});
  const [savingIssueDetail, setSavingIssueDetail] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingIssueForProjectId, setCreatingIssueForProjectId] = useState<string | null>(null);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  const manageableUsers = users
    .filter((u) => u.id !== user?.id)
    .filter((u) => {
      if (user?.role === "ADMIN") return true;
      if (user?.role === "DEVELOPER") return u.role === "CLIENT";
      return false;
    });

  // Load saved session
  useEffect(() => {
    if (isDemoMode) {
      resetDemoState();
      setToken("demo-token");
      setUser({
        id: "u-admin",
        username: "alex",
        name: "Alex Mercer",
        email: "alex@example.com",
        role: "ADMIN",
        active: true,
      });
      setAuthInitializing(false);
      return;
    }

    const lastActive = localStorage.getItem("lastActiveAt");
    const thirtyMinutesMs = 30 * 60 * 1000;
    const isExpired =
      !lastActive || Date.now() - Number(lastActive) > thirtyMinutesMs;

    if (isExpired) {
      localStorage.removeItem("lastActiveAt");
      logoutSession();
      setAuthInitializing(false);
      return;
    }

    (async () => {
      try {
        const { token: refreshedToken, user: refreshedUser } = await refreshSession();
        setToken(refreshedToken);
        setUser(refreshedUser);
      } catch {
        localStorage.removeItem("lastActiveAt");
      } finally {
        setAuthInitializing(false);
      }
    })();
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) return;
    if (!token) return;

    const updateActivity = () => {
      localStorage.setItem("lastActiveAt", String(Date.now()));
    };

    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, updateActivity));

    const interval = window.setInterval(() => {
      const lastActive = localStorage.getItem("lastActiveAt");
      const tenMinutesMs = 10 * 60 * 1000;
      if (!lastActive || Date.now() - Number(lastActive) > tenMinutesMs) {
        localStorage.removeItem("lastActiveAt");
        logoutSession();
        setToken(null);
        setUser(null);
      }
    }, 60 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, updateActivity));
      window.clearInterval(interval);
    };
  }, [isDemoMode, token]);

  useEffect(() => {
    function updateScrollbarState() {
      const el = boardScrollRef.current;
      if (!el) return;
      setHasBoardScrollbar(el.scrollHeight > el.clientHeight);
    }

    updateScrollbarState();
    window.addEventListener("resize", updateScrollbarState);
    return () => window.removeEventListener("resize", updateScrollbarState);
  }, [projects, searchTerm, filterProjectIds, filterAssigneeIds, filterPriorities, sortBy, sortDir]);

  async function fetchProjectsWithIssues() {
    if (!token) return;
    setProjectsLoading(true);
    try {
      const projects = await getProjects(token);
      const projectsWithIssues: ProjectWithIssues[] = await Promise.all(
        projects.map(async (project) => {
          try {
            const issues = await getIssuesForProject(project.id, token);
            return { ...project, issues };
          } catch (err) {
            console.error(`Error fetching issues for ${project.name}:`, err);
            return { ...project, issues: [] };
          }
        })
      );
      setProjects(projectsWithIssues);
    } catch (err) {
      console.error("Failed to load projects", err);
      openErrorModal("Load Failed", "Failed to load projects.");
    } finally {
      setProjectsLoading(false);
    }
  }


  useEffect(() => {
    if (!token) return;
    fetchProjectsWithIssues();
  }, [token]);

  useEffect(() => {
    const hasOpenModal =
      Boolean(issueModalProjectId) ||
      projectModalOpen ||
      utilitiesModalOpen ||
      settingsModalOpen ||
      aboutModalOpen ||
      Boolean(issueDetail) ||
      errorModal.open ||
      confirmState.open;
    if (!hasOpenModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmState.open) closeConfirmModal();
      if (errorModal.open) closeErrorModal();
      if (issueDetail) closeIssueDetail();
      if (utilitiesModalOpen) cancelUtilitiesModal();
      if (settingsModalOpen) closeSettingsModal();
      if (aboutModalOpen) closeAboutModal();
      if (issueModalProjectId) closeIssueModal();
      if (projectModalOpen) closeProjectModal();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    issueModalProjectId,
    projectModalOpen,
    utilitiesModalOpen,
    settingsModalOpen,
    aboutModalOpen,
    issueDetail,
    errorModal.open,
    confirmState.open,
  ]);


  // Fetch users
  async function fetchUsers() {
    if (!token) return;
    try {
      const data = await getUsers(token);
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      openErrorModal("Load Failed", "Could not load user list.");
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [token]);  

  // Handle login
  function handleLoginFromChild(token: string, user: User) {
    setToken(token);
    setUser(user);
    localStorage.setItem("lastActiveAt", String(Date.now()));
  }

  function openIssueModal(projectId: string, status: string = "NEW") {
    setIssueModalProjectId(projectId);
    setNewIssues((prev) => ({
      ...prev,
      [projectId]:
        prev[projectId]
          ? { ...prev[projectId], status }
          : {
              title: "",
              description: "",
              assigneeId: "",
              priority: "LOW",
              status,
            },
    }));
  }

  function closeIssueModal() {
    setIssueModalProjectId((prevProjectId) => {
      if (prevProjectId) {
        setNewIssues((prev) => ({
          ...prev,
          [prevProjectId]: {
            title: "",
            description: "",
            assigneeId: "",
            priority: "LOW",
            status: "NEW",
          },
        }));
      }
      return null;
    });
  }

  function openProjectModal() {
    setProjectModalOpen(true);
  }

  function closeProjectModal() {
    setProjectModalOpen(false);
    setNewProjectName("");
    setNewProjectDescription("");
    setNewProjectOwnerId("");
  }

  function resetUtilities() {
    setSearchTerm("");
    setSortBy("projectName");
    setSortDir("asc");
    setFilterProjectIds([]);
    setFilterAssigneeIds([]);
    setFilterPriorities([]);
  }

  function openUtilitiesModal() {
    setUtilitiesSnapshot({
      sortBy,
      sortDir,
      filterProjectIds: [...filterProjectIds],
      filterAssigneeIds: [...filterAssigneeIds],
      filterPriorities: [...filterPriorities],
    });
    setUtilitiesModalOpen(true);
  }

  function closeUtilitiesModal() {
    setUtilitiesModalOpen(false);
  }

  function cancelUtilitiesModal() {
    if (utilitiesSnapshot) {
      setSortBy(utilitiesSnapshot.sortBy);
      setSortDir(utilitiesSnapshot.sortDir);
      setFilterProjectIds(utilitiesSnapshot.filterProjectIds);
      setFilterAssigneeIds(utilitiesSnapshot.filterAssigneeIds);
      setFilterPriorities(utilitiesSnapshot.filterPriorities);
    }
    setUtilitiesModalOpen(false);
  }

  function openIssueDetail(projectId: string, projectName: string, issue: Issue) {
    setShowIssueComments(false);
    setIssueDetail({
      projectId,
      projectName,
      issueId: issue.id,
      original: issue,
      draft: {
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        status: issue.status,
        assigneeId: issue.assignee?.id || "",
      },
    });
  }

  function closeIssueDetail() {
    if (issueDetail) {
      setIssueCommentDrafts((prev) => ({
        ...prev,
        [issueDetail.issueId]: "",
      }));
    }
    setShowIssueComments(false);
    setIssueDetail(null);
  }

  async function saveIssueDetail() {
    if (!token || !issueDetail) return;
    setSavingIssueDetail(true);

    const { projectId, issueId, original, draft } = issueDetail;
    const isOwnIssue = original.assignee?.id === user?.id;
    const canEditTitleDescription =
      user?.role === "ADMIN" || (user?.role === "DEVELOPER" && isOwnIssue);
    const canEditMeta =
      user?.role === "ADMIN" || (user?.role === "DEVELOPER" && isOwnIssue);
    const canEditPriority =
      user?.role === "ADMIN" ||
      user?.role === "CLIENT" ||
      (user?.role === "DEVELOPER" && isOwnIssue);
    const updates: Promise<unknown>[] = [];

    if (canEditTitleDescription && draft.title !== original.title) {
      updates.push(updateIssueTitle(issueId, draft.title, token));
    }
    if (canEditTitleDescription && draft.description !== original.description) {
      updates.push(updateIssueDescription(issueId, draft.description, token));
    }
    if (canEditMeta && draft.status !== original.status) {
      updates.push(updateIssueStatus(issueId, draft.status, token));
    }
    if (canEditPriority && draft.priority !== original.priority) {
      updates.push(updateIssuePriority(issueId, draft.priority, token));
    }
    if (canEditMeta && draft.assigneeId !== (original.assignee?.id || "")) {
      updates.push(updateIssueAssignee(issueId, draft.assigneeId || null, token));
    }

    const commentText = (issueCommentDrafts[issueId] || "").trim();
    if (commentText) {
      const safeComment = DOMPurify.sanitize(commentText, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
      const author = user?.name || "Unknown";
      const createdAt = new Date().toLocaleString();
      setIssueCommentsById((prev) => ({
        ...prev,
        [issueId]: [...(prev[issueId] || []), { text: safeComment, author, createdAt }],
      }));
      setIssueCommentDrafts((prev) => ({ ...prev, [issueId]: "" }));
    }

    const shouldClose = updates.length > 0;
    if (shouldClose) {
      closeIssueDetail();
    } else {
      setShowIssueComments(true);
    }
    try {
      await Promise.all(updates);
      const assignee =
        draft.assigneeId
          ? users.find((u) => u.id === draft.assigneeId) || null
          : null;
      const mergedIssue: Issue = {
        ...original,
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        assignee,
      };

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                issues: p.issues.map((i) => (i.id === issueId ? mergedIssue : i)),
              }
            : p
        )
      );
      setIssuesByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] || []).map((i) =>
          i.id === issueId ? mergedIssue : i
        ),
      }));

      if (shouldClose) {
        closeIssueDetail();
      }
    } catch (err) {
      console.error("Failed to update issue:", err);
      openErrorModal("Save Failed", "Could not update issue.");
    } finally {
      setSavingIssueDetail(false);
    }
  }

  async function handleMoveIssue(issueId: string, projectId: string, status: string) {
    if (!token) return;
    try {
      await updateIssueStatus(issueId, status, token);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                issues: p.issues.map((i) =>
                  i.id === issueId ? { ...i, status } : i
                ),
              }
            : p
        )
      );
      setIssuesByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] || []).map((i) =>
          i.id === issueId ? { ...i, status } : i
        ),
      }));
    } catch (err) {
      console.error("Failed to update issue status:", err);
      openErrorModal("Move Failed", "Could not move issue.");
    }
  }

  function openConfirmModal(message: string, onConfirm: () => Promise<void> | void) {
    setConfirmState({ open: true, message, onConfirm });
  }

  function closeConfirmModal() {
    if (confirmingAction) return;
    setConfirmState({ open: false, message: "", onConfirm: null });
  }

  function openErrorModal(title: string, message: string) {
    setErrorModal({ open: true, title, message });
  }

  function closeErrorModal() {
    setErrorModal({ open: false, title: "", message: "" });
  }

  async function handleConfirm() {
    if (!confirmState.onConfirm) return;
    if (confirmingAction) return;
    setConfirmingAction(true);
    try {
      await confirmState.onConfirm();
      closeConfirmModal();
    } finally {
      setConfirmingAction(false);
    }
  }

  function openSettingsModal() {
    if (user) {
      setAccountDraft({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    }
    const next: Record<
      string,
      { username: string; name: string; email: string; role: string; active: boolean }
    > = {};
    manageableUsers.forEach((u) => {
      next[u.id] = {
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active !== false,
      };
    });
    setUserEditDrafts(next);
    setSettingsModalOpen(true);
  }

  function closeSettingsModal() {
    setSettingsModalOpen(false);
  }

  function openAboutModal() {
    setAboutModalOpen(true);
  }

  function closeAboutModal() {
    setAboutModalOpen(false);
  }

  async function saveSettings() {
    if (!token || !user) return;
    setSavingSettings(true);
    const updates: Promise<unknown>[] = [];
    const trimmedUsername = accountDraft.username.trim();
    const trimmedName = accountDraft.name.trim();
    const trimmedEmail = accountDraft.email.trim();
    const nextRole = accountDraft.role.trim();

    try {
      const accountUpdates: { username?: string; name?: string; email?: string; role?: string } = {};
      if (trimmedUsername && trimmedUsername !== user.username) {
        accountUpdates.username = trimmedUsername;
      }
      if (trimmedName && trimmedName !== user.name) accountUpdates.name = trimmedName;
      if (trimmedEmail && trimmedEmail !== user.email) accountUpdates.email = trimmedEmail;
      if (user.role === "ADMIN" && nextRole && nextRole !== user.role) {
        accountUpdates.role = nextRole;
      }

      if (Object.keys(accountUpdates).length) {
        updates.push(
          updateUser(user.id, accountUpdates, token).then((updated) => {
            setUser(updated);
            localStorage.setItem("user", JSON.stringify(updated));
          })
        );
      }

      manageableUsers.forEach((original) => {
        const draft = userEditDrafts[original.id];
        if (!draft) return;
        if (!original) return;
        const userUpdates: { username?: string; name?: string; email?: string; role?: string } = {};
        const draftUsername = draft.username.trim();
        const draftName = draft.name.trim();
        const draftEmail = draft.email.trim();
        if (draftUsername && draftUsername !== original.username) userUpdates.username = draftUsername;
        if (draftName && draftName !== original.name) userUpdates.name = draftName;
        if (draftEmail && draftEmail !== original.email) userUpdates.email = draftEmail;
        if (user.role === "ADMIN" && draft.role && draft.role !== original.role) {
          userUpdates.role = draft.role;
        }
        if (Object.keys(userUpdates).length) {
          updates.push(updateUser(original.id, userUpdates, token));
        }

        const originalActive = original.active !== false;
        if (draft.active !== originalActive) {
          updates.push(updateUserActive(original.id, draft.active, token));
        }
      });

      if (!updates.length) return;
      await Promise.all(updates);
      await fetchUsers();
      await fetchProjectsWithIssues();
    } catch (err) {
      console.error("Failed to update settings:", err);
      openErrorModal("Save Failed", "Could not update settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  function formatLabel(text: string) {
    return text
      //.toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatDate(value?: string) {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  }

  async function handleCreateProject() {
    if (!token || !newProjectName.trim() || creatingProject) return;

    setCreatingProject(true);
    try {
      setProjectModalOpen(false);
      await createProject(newProjectName, newProjectDescription, newProjectOwnerId || null, token);
      await fetchProjectsWithIssues();
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectOwnerId("");
    } catch (err) {
      console.error("Failed to create project:", err);
      openErrorModal("Create Failed", "Failed to create project.");
    } finally {
      setCreatingProject(false);
    }
  }
  
  async function handleCreateIssue(projectId: string) {
    if (!token) return;
    if (creatingIssueForProjectId) return;
    const issue = newIssues[projectId];
    if (!issue?.title?.trim()) return;

    try {
      setCreatingIssueForProjectId(projectId);
      setIssueModalProjectId(null);
      const created = await createIssue(
        token,
        projectId,
        issue.title,
        issue.description,
        issue.assigneeId || null,
        issue.priority || "LOW",
        issue.status || "NEW"
      );

      setIssuesByProject((prev) => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), created],
      }));

      setProjects((prev) =>
        prev.map((proj) =>
          proj.id === projectId
            ? { ...proj, issues: [...(proj.issues || []), created] }
            : proj
        )
      );

      setNewIssues((prev) => ({
        ...prev,
        [projectId]: {
          title: "",
          description: "",
          assigneeId: "",
          priority: "LOW",
          status: "NEW"          
        },
      }));
    } catch (err) {
      console.error("Failed to create issue:", err);
      openErrorModal("Create Failed", "Failed to create issue.");
    } finally {
      setCreatingIssueForProjectId(null);
    }
  }

  function handleDeleteProject(projectId: string) {
    openConfirmModal(
      "Delete this project and all its issues? This cannot be undone.",
      async () => {
        closeConfirmModal();
        try {
          await deleteProject(projectId, token!);
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
          const updatedIssues = { ...issuesByProject };
          delete updatedIssues[projectId];
          setIssuesByProject(updatedIssues);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Failed to delete project:", err);
          openErrorModal("Delete Failed", `Could not delete project: ${message}`);
        }
      }
    );
  }

  function handleDeleteIssue(issueId: string, projectId: string) {
    if (!token) return;
    openConfirmModal("Delete this issue? This cannot be undone.", async () => {
      try {
        await deleteIssue(issueId, token);
        setIssuesByProject((prev) => ({
          ...prev,
          [projectId]: (prev[projectId] || []).filter((i) => i.id !== issueId),
        }));
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, issues: p.issues.filter((i) => i.id !== issueId) }
              : p
          )
        );
      } catch (err) {
        console.error("Failed to delete issue:", err);
        openErrorModal("Delete Failed", "Could not delete issue.");
      }
    });
  }

  const modalProjectId = issueModalProjectId;

  if (authInitializing) {
    return (
      <div className="app-container app-loading-state" aria-live="polite">
        Loading session...
      </div>
    );
  }

   // Unauthenticated view
  if (!token || !user) return <Login onLogin={handleLoginFromChild} />;

  // Authenticated view
  return (
    //container
    <div className="app-container">
      {/* header container */}
      <AppHeader
        user={user}
        onOpenAbout={openAboutModal}
        onOpenSettings={openSettingsModal}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onLogout={() => {
          localStorage.removeItem("lastActiveAt");
          logoutSession();
          setToken(null);
          setUser(null);
        }}
      />

      {/* board partial */}
      <div className="header-row">
        {/* <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div> */}
        <button
          type="button"
          className="project-cell-header add-project"
          onClick={openProjectModal}
        >
          <span className="add-project-icon">
            <i className="fa-solid fa-plus"></i>
          </span>
          <span className="add-project-text">ADD NEW PROJECT</span>
        </button>
        {statuses.map((status) => (
          <div
            key={status}
            className={`status-column-header${status === "DONE" ? " status-column-done" : ""}`}
          >
            <span>{status}</span>
            {status === "DONE" && (
              <div className="utilities-controls">
                <button type="button" className="utilities-toggle" onClick={openUtilitiesModal}>
                  <i className="fa-solid fa-arrow-down-short-wide"></i>
                  <i className="fa-solid fa-filter"></i>
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="header-row-divider" aria-hidden="true"></div>
      </div>

      <div
        className={`board-scroll${hasBoardScrollbar ? " has-scrollbar" : ""}`}
        ref={boardScrollRef}
      >
        {projectsLoading ? (
          <div className="board-empty-state" role="status" aria-live="polite">
            Loading board...
          </div>
        ) : (
          <Board
            projects={projects}
            currentUser={user}
            searchTerm={searchTerm}
            sortBy={sortBy}
            sortDir={sortDir}
            filterProjectIds={filterProjectIds}
            filterAssigneeIds={filterAssigneeIds}
            filterPriorities={filterPriorities}
            onAddIssueClick={openIssueModal}
            onDeleteIssue={handleDeleteIssue}
            onDeleteProject={handleDeleteProject}
            onIssueClick={(issue, projectId, projectName) =>
              openIssueDetail(projectId, projectName, issue)
            }
            onIssueDrop={handleMoveIssue}
          />
        )}
      </div>

      <AppFooter />

      {aboutModalOpen && (
        <div
          onClick={closeAboutModal}
          className="modal-overlay modal-overlay-confirm"
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="About this site">
            <div className="modal-delete-header">
              <h2 style={{ margin: 0 }}>About This Site</h2>
              <button type="button" onClick={closeAboutModal} className="modal-delete-close">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p style={{ margin: "0 0 0.75rem 0" }}>
              This GitHub Pages experience is an interactive kanban demo built for portfolio review.
              It runs in demo mode with seeded data to showcase UI and workflow behavior without a live backend.
            </p>
            <p style={{ margin: 0 }}>
              Repository:
              {" "}
              <a href="https://github.com/jeremymwood/250720-kanban-site" target="_blank" rel="noreferrer">
                github.com/jeremymwood/250720-kanban-site
              </a>
            </p>
          </div>
        </div>
      )}

      {settingsModalOpen && (
        <div
          onClick={closeSettingsModal}
          className="modal-overlay modal-overlay-settings"
        >
          <div
            className="modal-card modal-settings"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <div className="modal-utilities-header">
                <h2 style={{ margin: 0 }}>Settings</h2>
              <button
                type="button"
                onClick={closeSettingsModal}
                className="modal-issue-close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">User Management</div>
              <div className="settings-users">
                <div className="settings-user settings-user-headings" aria-hidden="true">
                  <div className="settings-user-fields account-fields settings-user-field-headings">
                    <div>Username</div>
                    <div>Name</div>
                    <div>Email</div>
                    <div>Role</div>
                    <div>Status</div>
                    <div className="settings-user-controls">
                      <div className="settings-user-delete-placeholder">&nbsp;</div>
                    </div>
                  </div>
                </div>
                <div className="settings-user settings-user--self">
                  <div className="settings-user-fields account-fields">
                    <label>
                      <input
                        aria-label="Username"
                        value={accountDraft.username}
                        onChange={(e) =>
                          setAccountDraft((prev) => ({ ...prev, username: e.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <input
                        aria-label="Name"
                        value={accountDraft.name}
                        onChange={(e) =>
                          setAccountDraft((prev) => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <input
                        aria-label="Email"
                        value={accountDraft.email}
                        onChange={(e) =>
                          setAccountDraft((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      <select
                        aria-label="Role"
                        value={accountDraft.role}
                        disabled={user?.role !== "ADMIN"}
                        onChange={(e) =>
                          setAccountDraft((prev) => ({ ...prev, role: e.target.value }))
                        }
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-user-toggle-field">
                      <div
                        className={`settings-user-toggle-wrap${
                          (user?.active !== false) ? "" : " is-inactive"
                        }`}
                      >
                        <button
                          type="button"
                          aria-label="Account status"
                          className="settings-user-toggle"
                          disabled
                        >
                          {(user?.active !== false) ? (
                            <i className="fa-solid fa-toggle-on" aria-hidden="true"></i>
                          ) : (
                            <i className="fa-solid fa-toggle-off" aria-hidden="true"></i>
                          )}
                        </button>
                        <span className="settings-user-toggle-label">
                          {(user?.active !== false) ? "active" : "inactive"}
                        </span>
                      </div>
                    </label>
                    <div className="settings-user-controls">
                      <button
                        type="button"
                        className="settings-user-delete settings-user-delete-placeholder"
                        disabled
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                </div>
                {user.role !== "CLIENT" &&
                  users
                    .filter((u) => manageableUsers.some((item) => item.id === u.id))
                    .map((u) => (
                    <div
                      key={u.id}
                      className={`settings-user${
                        deletingUserId === u.id ? " settings-user--deleting" : ""
                      }`}
                    >
                      <div className="settings-user-fields">
                        {user.role === "ADMIN" ? (
                          <>
                            <label>
                              <input
                                aria-label="Username"
                                className="settings-user-input"
                                value={userEditDrafts[u.id]?.username ?? u.username}
                                onChange={(e) =>
                                  setUserEditDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: {
                                      username: e.target.value,
                                      name: prev[u.id]?.name ?? u.name,
                                      email: prev[u.id]?.email ?? u.email,
                                      role: prev[u.id]?.role ?? u.role,
                                      active: prev[u.id]?.active ?? (u.active !== false),
                                    },
                                  }))
                                }
                              />
                            </label>
                            <label>
                              <input
                                aria-label="Name"
                                className="settings-user-input"
                                value={userEditDrafts[u.id]?.name ?? u.name}
                                onChange={(e) =>
                                  setUserEditDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: {
                                      username: prev[u.id]?.username ?? u.username,
                                      name: e.target.value,
                                      email: prev[u.id]?.email ?? u.email,
                                      role: prev[u.id]?.role ?? u.role,
                                      active: prev[u.id]?.active ?? (u.active !== false),
                                    },
                                  }))
                                }
                              />
                            </label>
                            <label>
                              <input
                                aria-label="Email"
                                className="settings-user-input"
                                value={userEditDrafts[u.id]?.email ?? u.email}
                                onChange={(e) =>
                                  setUserEditDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: {
                                      username: prev[u.id]?.username ?? u.username,
                                      name: prev[u.id]?.name ?? u.name,
                                      email: e.target.value,
                                      role: prev[u.id]?.role ?? u.role,
                                      active: prev[u.id]?.active ?? (u.active !== false),
                                    },
                                  }))
                                }
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <label>
                              <span>{u.username}</span>
                            </label>
                            <label>
                              <span>{u.name}</span>
                            </label>
                            <label>
                              <span>{u.email}</span>
                            </label>
                          </>
                        )}
                        {user.role === "ADMIN" ? (
                          <>
                            <label className="settings-user-radio">
                              <select
                                aria-label="Role"
                                value={userEditDrafts[u.id]?.role ?? u.role}
                                onChange={(e) =>
                                  setUserEditDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: {
                                      username: prev[u.id]?.username ?? u.username,
                                      name: prev[u.id]?.name ?? u.name,
                                      email: prev[u.id]?.email ?? u.email,
                                      role: e.target.value,
                                      active: prev[u.id]?.active ?? (u.active !== false),
                                    },
                                  }))
                                }
                              >
                                {roleOptions.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </>
                        ) : (
                          <label className="settings-user-radio">
                            <span>{u.role}</span>
                          </label>
                        )}
                        <label className="settings-user-toggle-field">
                          <div
                            className={`settings-user-toggle-wrap${
                              (userEditDrafts[u.id]?.active ?? (u.active !== false)) ? "" : " is-inactive"
                            }`}
                          >
                            <button
                              type="button"
                              aria-label="Toggle active status"
                              className="settings-user-toggle"
                              onClick={() =>
                                setUserEditDrafts((prev) => ({
                                  ...prev,
                                  [u.id]: {
                                    username: prev[u.id]?.username ?? u.username,
                                    name: prev[u.id]?.name ?? u.name,
                                    email: prev[u.id]?.email ?? u.email,
                                    role: prev[u.id]?.role ?? u.role,
                                    active: !(prev[u.id]?.active ?? (u.active !== false)),
                                  },
                                }))
                              }
                            >
                              {(userEditDrafts[u.id]?.active ?? (u.active !== false)) ? (
                                <i className="fa-solid fa-toggle-on" aria-hidden="true"></i>
                              ) : (
                                <i className="fa-solid fa-toggle-off" aria-hidden="true"></i>
                              )}
                            </button>
                            <span className="settings-user-toggle-label">
                              {(userEditDrafts[u.id]?.active ?? (u.active !== false)) ? "active" : "inactive"}
                            </span>
                          </div>
                        </label>
                        <div className="settings-user-controls">
                          <button
                            type="button"
                            className="settings-user-delete"
                            disabled={
                              u.id === user.id ||
                              user.role === "CLIENT" ||
                              (user.role === "DEVELOPER" && u.role !== "CLIENT")
                            }
                            onClick={() => {
                              openConfirmModal(
                                `Delete ${u.name}?`,
                                async () => {
                                  closeConfirmModal();
                                  setDeletingUserId(u.id);
                                  try {
                                    await deleteUser(u.id, token!);
                                    await fetchUsers();
                                    await fetchProjectsWithIssues();
                                  } catch (err) {
                                    const message = err instanceof Error ? err.message : String(err);
                                    console.error("Failed to delete user:", err);
                                    openErrorModal("Delete Failed", `Could not delete user: ${message}`);
                                  } finally {
                                    setDeletingUserId(null);
                                  }
                                }
                              );
                            }}
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="settings-actions">
              <button type="button" className="modal-cancel" onClick={closeSettingsModal}>
                Cancel
              </button>
              <button type="button" className="modal-save" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}


      {modalProjectId && (
        <div
          onClick={closeIssueModal}
          className="modal-overlay modal-overlay-strong"
        >
          <div
            className="modal-card issue-detail-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create issue"
            >
            <div className="issue-detail-header">
              <h2 style={{ margin: 0 }}>New Issue</h2>
              <button
                type="button"
                onClick={closeIssueModal}
                className="modal-issue-close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateIssue(modalProjectId);
              }}
              className="issue-detail-fields"
            >
              <label>
                Title
                <input
                  id={`New-Issue-Title-${modalProjectId}`}
                  placeholder="New issue title"
                  value={newIssues[modalProjectId]?.title || ""}
                  disabled={creatingIssueForProjectId === modalProjectId}
                  style={{ 
                    width: "auto"
                  }}
                  onChange={(e) =>
                    setNewIssues((prev) => ({
                      ...prev,
                      [modalProjectId]: {
                        ...(prev[modalProjectId] || { description: "", assigneeId: "", priority: "LOW", status: "NEW" }),
                        title: e.target.value,
                      },
                    }))
                  }
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  id={`New-Issue-Description-${modalProjectId}`}
                  placeholder="Description"
                  value={newIssues[modalProjectId]?.description || ""}
                  disabled={creatingIssueForProjectId === modalProjectId}
                  style={{ 
                    width: "auto"
                  }}
                  onChange={(e) =>
                    setNewIssues((prev) => ({
                      ...prev,
                      [modalProjectId]: {
                        ...(prev[modalProjectId] || { title: "", assigneeId: "", priority: "LOW", status: "NEW" }),
                        description: e.target.value,
                      },
                    }))
                  }
                  rows={4}
                />
              </label>
              <div className="issue-detail-row">
                <label>
                  Status
                  <select
                    id={`New-Issue-Status-${modalProjectId}`}
                    value={newIssues[modalProjectId]?.status || "NEW"}
                    disabled={creatingIssueForProjectId === modalProjectId}
                    onChange={(e) =>
                      setNewIssues((prev) => ({
                        ...prev,
                        [modalProjectId]: {
                          ...(prev[modalProjectId] || { title: "", description: "", assigneeId: "", priority: "LOW" }),
                          status: e.target.value,
                        },
                      }))
                    }
                  >
                    {statuses.map((p) => (
                      <option key={p} value={p}>
                        {formatLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    id={`New-Issue-Priority-${modalProjectId}`}
                    value={newIssues[modalProjectId]?.priority || "LOW"}
                    disabled={creatingIssueForProjectId === modalProjectId}
                    onChange={(e) =>
                      setNewIssues((prev) => ({
                        ...prev,
                        [modalProjectId]: {
                          ...(prev[modalProjectId] || { title: "", description: "", assigneeId: "" }),
                          priority: e.target.value,
                        },
                      }))
                    }
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {formatLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assignee
                  <select
                    id={`New-Issue-Assignee-${modalProjectId}`}
                    value={newIssues[modalProjectId]?.assigneeId || ""}
                    disabled={creatingIssueForProjectId === modalProjectId}
                    onChange={(e) =>
                      setNewIssues((prev) => ({
                        ...prev,
                        [modalProjectId]: {
                          ...(prev[modalProjectId] || { title: "", description: "", priority: "LOW", status: "NEW" }),
                          assigneeId: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="issue-detail-actions">
                <button
                  className="modal-cancel"
                  type="button"
                  onClick={closeIssueModal}
                  disabled={creatingIssueForProjectId === modalProjectId}
                >
                  Cancel
                </button>
                <button
                  className="modal-create"
                  type="submit"
                  disabled={
                    creatingIssueForProjectId === modalProjectId ||
                    !(newIssues[modalProjectId]?.title || "").trim()
                  }
                >
                  {creatingIssueForProjectId === modalProjectId ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {projectModalOpen && (
        <div
          onClick={closeProjectModal}
          className="modal-overlay modal-overlay-project"
        >
          <div
            className="modal-card issue-detail-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create project"
            >
            <div className="issue-detail-header">
              <h2 style={{ margin: 0 }}>Add New Project</h2>
              <button
                type="button"
                onClick={closeProjectModal}
                className="modal-issue-close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateProject();
              }}
              className="issue-detail-fields"
            >
              <label>
                Project Name
                <input
                  placeholder="Project name"
                  value={newProjectName}
                  disabled={creatingProject}
                  style={{
                    width: "auto",
                  }}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  placeholder="Description"
                  value={newProjectDescription}
                  disabled={creatingProject}
                  style={{
                    width: "auto",
                  }}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  rows={4}
                />
              </label>
              <label>
                Owner
                <select
                  value={newProjectOwnerId}
                  disabled={creatingProject}
                  onChange={(e) => setNewProjectOwnerId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="issue-detail-actions">
                <button className="modal-cancel" type="button" onClick={closeProjectModal} disabled={creatingProject}>
                  Cancel
                </button>
                <button className="modal-save" type="submit" disabled={creatingProject || !newProjectName.trim()}>
                  {creatingProject ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {utilitiesModalOpen && (
        <div
          onClick={closeUtilitiesModal}
          className="modal-overlay modal-overlay-utilities"
        >
          <div
            className="modal-card modal-utilities"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Sort and filter"
          >
            <div className="modal-utilities-header">
              <h2 style={{ margin: 0 }}>Sort & Filter</h2>
              <button
                type="button"
                onClick={closeUtilitiesModal}
                className="modal-utilities-close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-utilities-grid">
              <div>
                <div className="dropdown-title">Sort By</div>
                {[
                  { value: "projectName", label: "Project Name" },
                  { value: "projectCreatedAt", label: "Project Created" },
                  { value: "issueTitle", label: "Issue Name" },
                  { value: "issueCreatedAt", label: "Issue Created" },
                  { value: "issuePriority", label: "Issue Urgency" },
                  { value: "projectAssignee", label: "Project Assignee" },
                  { value: "issueAssignee", label: "Issue Assignee" },
                ].map((opt) => (
                  <label key={opt.value} className="dropdown-option">
                    <input
                      type="radio"
                      name="sortBy"
                      checked={sortBy === opt.value}
                      onChange={() =>
                        setSortBy(
                          opt.value as
                            | "projectName"
                            | "projectCreatedAt"
                            | "issueTitle"
                            | "issueCreatedAt"
                            | "issuePriority"
                            | "projectAssignee"
                            | "issueAssignee"
                        )
                      }
                    />
                    {opt.label}
                  </label>
                ))}
                <div className="dropdown-title">Direction</div>
                <label className="dropdown-option">
                  <input
                    type="radio"
                    name="sortDir"
                    checked={sortDir === "asc"}
                    onChange={() => setSortDir("asc")}
                  />
                  A–Z / Oldest
                </label>
                <label className="dropdown-option">
                  <input
                    type="radio"
                    name="sortDir"
                    checked={sortDir === "desc"}
                    onChange={() => setSortDir("desc")}
                  />
                  Z–A / Newest
                </label>
              </div>
              <div>
                <div className="dropdown-title">Projects</div>
                {projects.map((p) => (
                  <label key={p.id} className="dropdown-option">
                    <input
                      type="checkbox"
                      checked={filterProjectIds.includes(p.id)}
                      onChange={() =>
                        setFilterProjectIds((prev) =>
                          prev.includes(p.id)
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id]
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
                <div className="dropdown-title">Assignees</div>
                {users.map((u) => (
                  <label key={u.id} className="dropdown-option">
                    <input
                      type="checkbox"
                      checked={filterAssigneeIds.includes(u.id)}
                      onChange={() =>
                        setFilterAssigneeIds((prev) =>
                          prev.includes(u.id)
                            ? prev.filter((id) => id !== u.id)
                            : [...prev, u.id]
                        )
                      }
                    />
                    {u.name}
                  </label>
                ))}
                <div className="dropdown-title">Issue Priority</div>
                {priorities.map((p) => (
                  <label key={p} className="dropdown-option">
                    <input
                      type="checkbox"
                      checked={filterPriorities.includes(p)}
                      onChange={() =>
                        setFilterPriorities((prev) =>
                          prev.includes(p)
                            ? prev.filter((val) => val !== p)
                            : [...prev, p]
                        )
                      }
                    />
                    {formatLabel(p)}
                  </label>
                ))}
              </div>
            </div>
            <div className="utilities-actions">
              <button type="button" className="modal-utilities-cancel" onClick={cancelUtilitiesModal}>
                Cancel
              </button>
              <button type="button" className="modal-utilities-reset" onClick={resetUtilities}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {issueDetail && (
        <div
          onClick={closeIssueDetail}
          className="modal-overlay modal-overlay-issue-detail"
        >
          {(() => {
            const isOwnIssue = issueDetail.original.assignee?.id === user?.id;
            const canEditTitleDescription =
              user?.role === "ADMIN" || (user?.role === "DEVELOPER" && isOwnIssue);
            const canEditMeta =
              user?.role === "ADMIN" || (user?.role === "DEVELOPER" && isOwnIssue);
            const canEditPriority =
              user?.role === "ADMIN" ||
              user?.role === "CLIENT" ||
              (user?.role === "DEVELOPER" && isOwnIssue);
            const hasCommentDraft =
              (issueCommentDrafts[issueDetail.issueId] || "").trim().length > 0;
            const canSave =
              canEditTitleDescription || canEditMeta || canEditPriority || hasCommentDraft;
            return (
          <div
            className={`modal-card${showIssueComments ? " modal-card-expanded" : ""}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Issue details"
          >
            <div className="issue-detail-header">
              <div>
                <h2 style={{ margin: 0 }}>{issueDetail.original.title}</h2>
                <div style={{ display: "flex"}}>
                  <small>{issueDetail.projectName},</small>
                  <div className="issue-detail-meta">
                    Created: {formatDate(issueDetail.original.createdAt)}
                  </div>                  
                </div>
              </div>
              <button
                type="button"
                onClick={closeIssueDetail}
                className="modal-issue-close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="issue-detail-fields">
              <label>
                Title
                <input
                  style={{
                    width: "auto"
                  }}
                  disabled={!canEditTitleDescription}
                  value={issueDetail.draft.title}
                  onChange={(e) =>
                    setIssueDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            draft: { ...prev.draft, title: e.target.value },
                          }
                        : prev
                    )
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  style={{
                    width: "auto"
                  }}
                  disabled={!canEditTitleDescription}
                  value={issueDetail.draft.description}
                  onChange={(e) =>
                    setIssueDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            draft: { ...prev.draft, description: e.target.value },
                          }
                        : prev
                    )
                  }
                  rows={4}
                />
              </label>
              <div className="issue-detail-row">
                <label>
                  Status
                  <select
                    value={issueDetail.draft.status}
                    disabled={!canEditMeta}
                    onChange={(e) =>
                      setIssueDetail((prev) =>
                        prev
                          ? {
                              ...prev,
                              draft: { ...prev.draft, status: e.target.value },
                            }
                          : prev
                      )
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {formatLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={issueDetail.draft.priority}
                    disabled={!canEditPriority}
                    onChange={(e) =>
                      setIssueDetail((prev) =>
                        prev
                          ? {
                              ...prev,
                              draft: { ...prev.draft, priority: e.target.value },
                            }
                          : prev
                      )
                    }
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {formatLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assignee
                  <select
                    value={issueDetail.draft.assigneeId}
                    disabled={!canEditMeta}
                    onChange={(e) =>
                      setIssueDetail((prev) =>
                        prev
                          ? {
                              ...prev,
                              draft: { ...prev.draft, assigneeId: e.target.value },
                            }
                          : prev
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="issue-detail-comments">
              <button
                type="button"
                className="issue-comments-toggle"
                onClick={() => setShowIssueComments((prev) => !prev)}
              >
                {showIssueComments ? "Hide comments" : "Comments"}
              </button>
              {showIssueComments && (
                <>
                  <div className="issue-detail-comments-body">
                    {(() => {
                      const comments = issueCommentsById[issueDetail.issueId] || [];
                      if (!comments.length) {
                        return <p>No comments yet.</p>;
                      }
                      return comments.map((comment, index) => (
                        <div key={`${comment.createdAt}-${index}`} className="issue-comment-item">
                          <div className="issue-comment-content">
                            <p>{comment.text}</p>
                            <div style={{ display: "flex" }}>
                              <small>{comment.author},</small>
                              <div className="issue-detail-meta">
                                Created: {comment.createdAt}
                              </div>
                            </div>
                          </div>
                          {user?.role === "ADMIN" && (
                            <button
                              type="button"
                              className="issue-comment-delete"
                              onClick={(event) => {
                                event.stopPropagation();
                                openConfirmModal("Delete this comment?", async () => {
                                  setIssueCommentsById((prev) => ({
                                    ...prev,
                                    [issueDetail.issueId]: (prev[issueDetail.issueId] || []).filter(
                                      (_, commentIndex) => commentIndex !== index
                                    ),
                                  }));
                                });
                              }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                  <label className="issue-detail-comments-input">
                    <textarea
                      placeholder="Leave a comment"
                      rows={3}
                      value={issueCommentDrafts[issueDetail.issueId] || ""}
                      onChange={(e) =>
                        setIssueCommentDrafts((prev) => ({
                          ...prev,
                          [issueDetail.issueId]: e.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}
            </div>
            <div className="issue-detail-actions">
              <button type="button" onClick={closeIssueDetail} disabled={savingIssueDetail}>
                Cancel
              </button>
              <button type="button" onClick={saveIssueDetail} disabled={!canSave || savingIssueDetail}>
                {savingIssueDetail ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
            );
          })()}
        </div>
      )}

      {errorModal.open && (
        <div onClick={closeErrorModal} className="modal-overlay modal-overlay-confirm">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Error">
            <div className="modal-delete-header">
              <h2 style={{ margin: 0 }}>{errorModal.title || "Error"}</h2>
              <button type="button" onClick={closeErrorModal} className="modal-delete-close">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p style={{ margin: "0 0 1rem 0" }}>{errorModal.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button className="modal-delete-cancel" type="button" onClick={closeErrorModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState.open && (
        <div
          onClick={() => {
            if (!confirmingAction) closeConfirmModal();
          }}
          className="modal-overlay modal-overlay-confirm"
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal-delete-header">
              <h2 style={{ margin: 0 }}>Confirm Delete</h2>
              <button
                type="button"
                onClick={closeConfirmModal}
                className="modal-delete-close"
                disabled={confirmingAction}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p style={{ margin: "0 0 1rem 0" }}>{confirmState.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                className="modal-delete-cancel"
                type="button"
                disabled={confirmingAction}
                onClick={closeConfirmModal}>
                Cancel
              </button>
              <button
                className="modal-delete-delete"
                type="button"
                disabled={confirmingAction}
                onClick={handleConfirm}
              >
                {confirmingAction ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
