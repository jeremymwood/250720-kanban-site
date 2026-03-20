import React, { useEffect, useState } from "react";
//import { IssueStatus } from "../../server/node_modules/.prisma/client/index"
import type { ProjectWithIssues, User } from "../types";

const STATUSES = ["NEW", "COMMITTED", "IN_PROGRESS", "QA", "DONE"] as const;

interface BoardProps {
  projects: ProjectWithIssues[];
  searchTerm: string;
  sortBy:
    | "projectName"
    | "projectCreatedAt"
    | "issueTitle"
    | "issueCreatedAt"
    | "issuePriority"
    | "projectAssignee"
    | "issueAssignee";
  sortDir: "asc" | "desc";
  filterProjectIds: string[];
  filterAssigneeIds: string[];
  filterPriorities: string[];
  onAddIssueClick: (projectId: string, status?: string) => void;
  onDeleteIssue: (issueId: string, projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onIssueClick: (
    issue: ProjectWithIssues["issues"][number],
    projectId: string,
    projectName: string
  ) => void;
  onIssueDrop: (issueId: string, projectId: string, status: string) => void;
  currentUser: User;
}

const Board: React.FC<BoardProps> = ({
  projects,
  searchTerm,
  sortBy,
  sortDir,
  filterProjectIds,
  filterAssigneeIds,
  filterPriorities,
  onAddIssueClick,
  onDeleteIssue,
  onDeleteProject,
  onIssueClick,
  onIssueDrop,
  currentUser,
}) => {
  const [dragOriginProjectId, setDragOriginProjectId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ projectId: string; status: string } | null>(null);
  const [readonlyInvalidIssueId, setReadonlyInvalidIssueId] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileProjectId, setMobileProjectId] = useState<string | null>(null);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const apply = () => setIsMobileView(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  function matchesSearch(text?: string) {
    if (!hasSearch) return true;
    return (text || "").toLowerCase().includes(normalizedSearch);
  }

  function projectMatches(project: ProjectWithIssues) {
    return (
      matchesSearch(project.name) ||
      matchesSearch(project.description) ||
      matchesSearch(project.owner?.name) ||
      matchesSearch(project.owner?.email)
    );
  }

  function issueMatches(issue: ProjectWithIssues["issues"][number]) {
    return (
      matchesSearch(issue.title) ||
      matchesSearch(issue.description) ||
      matchesSearch(issue.status) ||
      matchesSearch(issue.priority) ||
      matchesSearch(issue.assignee?.name) ||
      matchesSearch(issue.assignee?.email)
    );
  }

  function compareDates(a?: string, b?: string) {
    const aTime = a ? Date.parse(a) : 0;
    const bTime = b ? Date.parse(b) : 0;
    return aTime - bTime;
  }

  function compareProject(a: ProjectWithIssues, b: ProjectWithIssues) {
    let cmp = 0;
    if (sortBy === "projectName") {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === "projectCreatedAt") {
      cmp = compareDates(a.createdAt, b.createdAt);
    } else if (sortBy === "projectAssignee") {
      cmp = (a.owner?.name || "").localeCompare(b.owner?.name || "");
    } else {
      cmp = a.name.localeCompare(b.name);
    }
    return sortDir === "asc" ? cmp : -cmp;
  }

  function compareIssue(
    a: ProjectWithIssues["issues"][number],
    b: ProjectWithIssues["issues"][number]
  ) {
    let cmp = 0;
    if (sortBy === "issueTitle") {
      cmp = a.title.localeCompare(b.title);
    } else if (sortBy === "issueCreatedAt") {
      cmp = compareDates(a.createdAt, b.createdAt);
    } else if (sortBy === "issuePriority") {
      cmp = a.priority.localeCompare(b.priority);
    } else if (sortBy === "issueAssignee") {
      cmp = (a.assignee?.name || "").localeCompare(b.assignee?.name || "");
    }
    if (cmp === 0 && hasSearch) {
      cmp = a.title.localeCompare(b.title);
    }
    if (cmp === 0) return 0;
    return sortDir === "asc" ? cmp : -cmp;
  }

  const filteredProjects = projects.filter((project) => {
    if (filterProjectIds.length && !filterProjectIds.includes(project.id)) {
      return false;
    }

    if (filterAssigneeIds.length) {
      const ownerMatch = project.owner?.id && filterAssigneeIds.includes(project.owner.id);
      const issueAssigneeMatch = project.issues.some(
        (issue) => issue.assignee?.id && filterAssigneeIds.includes(issue.assignee.id)
      );
      if (!ownerMatch && !issueAssigneeMatch) return false;
    }

    if (filterPriorities.length) {
      const priorityMatch = project.issues.some((issue) =>
        filterPriorities.includes(issue.priority)
      );
      if (!priorityMatch) return false;
    }

    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (hasSearch) {
      const aRelevant =
        projectMatches(a) || a.issues.some((issue) => issueMatches(issue));
      const bRelevant =
        projectMatches(b) || b.issues.some((issue) => issueMatches(issue));
      if (aRelevant !== bRelevant) {
        return aRelevant ? -1 : 1;
      }
    }
    return compareProject(a, b);
  });

  useEffect(() => {
    if (!isMobileView) {
      setMobileProjectId(null);
      return;
    }
    if (mobileProjectId && !sortedProjects.some((p) => p.id === mobileProjectId)) {
      setMobileProjectId(null);
    }
  }, [isMobileView, mobileProjectId, sortedProjects]);

  if (!sortedProjects.length) {
    return (
      <div className="board-empty-state" role="status" aria-live="polite">
        {hasSearch || filterProjectIds.length || filterAssigneeIds.length || filterPriorities.length
          ? "No projects match your current search and filters."
          : "No projects yet. Use the + button to create your first project."}
      </div>
    );
  }

  if (isMobileView) {
    const selectedProject = mobileProjectId
      ? sortedProjects.find((p) => p.id === mobileProjectId) ?? null
      : null;

    return (
      <>
        <div className="board-grid board-grid-mobile">
          {sortedProjects.map((project) => {
            const projectIsRelevant =
              !hasSearch ||
              projectMatches(project) ||
              project.issues.some((issue) => issueMatches(issue));
            return (
              <button
                type="button"
                key={project.id}
                className={`project-cell project-cell-mobile${projectIsRelevant ? "" : " dimmed"}`}
                onClick={() => setMobileProjectId(project.id)}
              >
                <div className="project-card-header">
                  <strong>{project.name}</strong>
                </div>
                {project.description && <p>{project.description}</p>}
                <div className="project-owner-row">
                  {project.owner ? (
                    <div className="project-owner">
                      <small>
                        <i className="fa-regular fa-user"></i> {project.owner.name}
                      </small>
                    </div>
                  ) : (
                    <div className="project-owner">
                      <small>Owner: Unassigned</small>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selectedProject && (
          <div className="modal-overlay modal-overlay-issue-detail" onClick={() => setMobileProjectId(null)}>
            <div
              className="modal-card modal-mobile-project"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedProject.name} issues`}
            >
              <div className="issue-detail-header">
                <h2 style={{ margin: 0 }}>{selectedProject.name}</h2>
                <button type="button" className="modal-issue-close" onClick={() => setMobileProjectId(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <p className="modal-mobile-project-description">{selectedProject.description}</p>

              <div className="mobile-project-issues">
                {STATUSES.map((status) => {
                  const issuesInStatus = selectedProject.issues
                    .filter((i) => i.status === status)
                    .filter((i) => {
                      if (filterAssigneeIds.length) {
                        const assigneeId = i.assignee?.id;
                        if (!assigneeId || !filterAssigneeIds.includes(assigneeId)) return false;
                      }
                      if (filterPriorities.length && !filterPriorities.includes(i.priority)) return false;
                      return true;
                    })
                    .sort((a, b) => {
                      if (hasSearch) {
                        const aMatch = issueMatches(a);
                        const bMatch = issueMatches(b);
                        if (aMatch !== bMatch) return aMatch ? -1 : 1;
                      }
                      return compareIssue(a, b);
                    });

                  return (
                    <section key={status} className="mobile-status-section">
                      <h3 className="mobile-status-title">{status.replace("_", " ")}</h3>
                      {issuesInStatus.length === 0 ? (
                        <p className="issue-cell-empty">No issues</p>
                      ) : (
                        issuesInStatus.map((issue) => {
                          const isLockedForDeveloper =
                            currentUser.role === "DEVELOPER" &&
                            issue.assignee?.id !== currentUser.id;
                          return (
                            <div
                              key={issue.id}
                              className={`issue-card${issueMatches(issue) ? "" : " dimmed"}${isLockedForDeveloper ? " issue-card-readonly" : ""}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => onIssueClick(issue, selectedProject.id, selectedProject.name)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onIssueClick(issue, selectedProject.id, selectedProject.name);
                                }
                              }}
                            >
                              <div className="issue-card-header">
                                <strong>{issue.title}</strong>
                                <div className="issue-card-actions">
                                  {issue.priority !== "LOW" && (
                                    <span className={`priority-bookmark priority-${issue.priority.toLowerCase()}`} aria-hidden="true">
                                      <i className="fa-solid fa-bookmark"></i>
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className="issue-delete"
                                    disabled={isLockedForDeveloper}
                                    tabIndex={isLockedForDeveloper ? -1 : 0}
                                    onClick={(e) => {
                                      if (isLockedForDeveloper) return;
                                      e.stopPropagation();
                                      onDeleteIssue(issue.id, selectedProject.id);
                                    }}
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </div>
                              </div>
                              {issue.assignee?.name && (
                                <div className="assignee">
                                  <i className="fa-regular fa-user"></i> {issue.assignee.name}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="board-grid">
      {sortedProjects.map((project) => {
        const projectIsRelevant =
          !hasSearch ||
          projectMatches(project) ||
          project.issues.some((issue) => issueMatches(issue));
        return (
        <div key={project.id} className="project-row">
          <div className={`project-cell${projectIsRelevant ? "" : " dimmed"}`}>
            <div className="project-card-header">
              {project.name}
              <div className="project-card-actions">
                <button
                  type="button"
                  id="project-delete"
                  className="button-xmark"
                  onClick={() => onDeleteProject(project.id)}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
            <p>{project.description}</p>
            <div className="project-owner-row">
              {project.owner ? (
                <div className="project-owner">
                  <small>
                    <i className="fa-regular fa-user"></i> {project.owner.name}
                  </small>
                </div>
              ) : (
                <div className="project-owner">
                  <small>Owner: Unassigned</small>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onAddIssueClick(project.id)}
              className="button-plus project-add-issue"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

          {STATUSES.map((status) => {
            const issuesInStatus = project.issues
              .filter((i) => i.status === status)
              .filter((i) => {
                if (filterAssigneeIds.length) {
                  const assigneeId = i.assignee?.id;
                  if (!assigneeId || !filterAssigneeIds.includes(assigneeId)) {
                    return false;
                  }
                }
                if (filterPriorities.length && !filterPriorities.includes(i.priority)) {
                  return false;
                }
                return true;
              })
              .sort((a, b) => {
                if (hasSearch) {
                  const aMatch = issueMatches(a);
                  const bMatch = issueMatches(b);
                  if (aMatch !== bMatch) return aMatch ? -1 : 1;
                }
                return compareIssue(a, b);
              });
            const isDragOver =
              dragOver?.projectId === project.id && dragOver?.status === status;
            const isInvalidTarget =
              isDragOver && dragOriginProjectId && dragOriginProjectId !== project.id;
            return (
              <div
                key={status}
                className={`issue-cell${isDragOver ? (isInvalidTarget ? " drag-invalid" : " drag-target") : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setDragOver({ projectId: project.id, status })}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  const issueId = e.dataTransfer.getData("text/issueId");
                  const originProjectId = e.dataTransfer.getData("text/projectId");
                  setDragOver(null);
                  if (!issueId || originProjectId !== project.id) return;
                  onIssueDrop(issueId, project.id, status);
                }}
              >
                {issuesInStatus.map((issue) => {
                  const isLockedForDeveloper =
                    currentUser.role === "DEVELOPER" &&
                    issue.assignee?.id !== currentUser.id;
                  const isMoveLocked = currentUser.role === "CLIENT" || isLockedForDeveloper;
                  return (
                  <div
                    key={issue.id}
                    className={`issue-card${issueMatches(issue) ? "" : " dimmed"}${isMoveLocked ? " issue-card-readonly" : ""}${readonlyInvalidIssueId === issue.id ? " issue-card-readonly-invalid" : ""}`}
                    draggable={!isMoveLocked}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open issue ${issue.title}`}
                    onMouseDown={(e) => {
                      if (!isMoveLocked || e.button !== 0) return;
                      const issueCell = (e.currentTarget as HTMLElement).closest(".issue-cell") as HTMLElement | null;
                      if (!issueCell) return;

                      const isOutsideIssueCell = (event: MouseEvent) => {
                        const rect = issueCell.getBoundingClientRect();
                        return (
                          event.clientX < rect.left ||
                          event.clientX > rect.right ||
                          event.clientY < rect.top ||
                          event.clientY > rect.bottom
                        );
                      };

                      const handleMouseMove = (event: MouseEvent) => {
                        const isOutside = isOutsideIssueCell(event);
                        setReadonlyInvalidIssueId((prev) => {
                          if (isOutside) return issue.id;
                          return prev === issue.id ? null : prev;
                        });
                      };

                      const handleMouseUp = () => {
                        setReadonlyInvalidIssueId((prev) => (prev === issue.id ? null : prev));
                        window.removeEventListener("mousemove", handleMouseMove);
                        window.removeEventListener("mouseup", handleMouseUp);
                      };

                      window.addEventListener("mousemove", handleMouseMove);
                      window.addEventListener("mouseup", handleMouseUp);
                    }}
                    onDragStart={(e) => {
                      if (isMoveLocked) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData("text/issueId", issue.id);
                      e.dataTransfer.setData("text/projectId", project.id);
                      setDragOriginProjectId(project.id);
                    }}
                    onDragEnd={() => {
                      setDragOriginProjectId(null);
                      setDragOver(null);
                    }}
                    onClick={() => onIssueClick(issue, project.id, project.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onIssueClick(issue, project.id, project.name);
                      }
                    }}
                  >
                    <div className="issue-card-header">
                      <strong>{issue.title}</strong>
                      <div className="issue-card-actions">
                        {issue.priority !== "LOW" && (
                          <span
                            className={`priority-bookmark priority-${issue.priority.toLowerCase()}`}
                            aria-hidden="true"
                          >
                            <i className="fa-solid fa-bookmark"></i>
                          </span>
                        )}
                        <button
                          type="button"
                          className="issue-delete"
                          disabled={isLockedForDeveloper}
                          tabIndex={isLockedForDeveloper ? -1 : 0}
                          onClick={(e) => {
                            if (isLockedForDeveloper) return;
                            e.stopPropagation();
                            onDeleteIssue(issue.id, project.id);
                          }}
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                    {issue.assignee?.name && (
                      <div className="assignee">
                        <i className="fa-regular fa-user"></i> {issue.assignee.name}
                      </div>
                    )}
                  </div>
                  );
                })}
                {issuesInStatus.length === 0 && (
                  <p className="issue-cell-empty">No issues</p>
                )}
                <button
                  type="button"
                  className="button-plus"
                  onClick={() => onAddIssueClick(project.id, status)}
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
            );
          })}
        </div>
      );
      })}
    </div>
  );
};

export default Board;
