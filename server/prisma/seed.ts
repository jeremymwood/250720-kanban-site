import { IssuePriority, IssueStatus, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const statuses: IssueStatus[] = [
  IssueStatus.NEW,
  IssueStatus.COMMITTED,
  IssueStatus.IN_PROGRESS,
  IssueStatus.QA,
  IssueStatus.DONE,
];

const priorities: IssuePriority[] = [
  IssuePriority.LOW,
  IssuePriority.MEDIUM,
  IssuePriority.HIGH,
  IssuePriority.URGENT,
];

function issueCountFor(projectIndex: number, statusIndex: number): number {
  // Guarantees 2-3 issues per lane while still varying by project and status.
  return (projectIndex + statusIndex) % 2 === 0 ? 2 : 3;
}

const issueTitleStarts = [
  "Refine",
  "Harden",
  "Polish",
  "Stabilize",
  "Streamline",
  "Improve",
  "Finalize",
  "Validate",
  "Clarify",
  "Tune",
  "Audit",
  "Align",
  "Standardize",
  "Optimize",
  "Coordinate",
] as const;

const issueTitleEnds = [
  "Session Recovery",
  "Permission Checks",
  "Form Validation",
  "Error Handling",
  "Request Lifecycle",
  "Input Sanitization",
  "State Synchronization",
  "Header Navigation",
  "Search Experience",
  "Modal Accessibility",
  "Notification Messaging",
  "Response Contracts",
  "Telemetry Hooks",
  "Data Consistency",
  "Release Readiness",
] as const;

function issueTitleFor(index: number): string {
  const start = issueTitleStarts[index % issueTitleStarts.length];
  const end = issueTitleEnds[Math.floor(index / issueTitleStarts.length) % issueTitleEnds.length];
  return `${start} ${end}`;
}

async function main() {
  console.log("Seeding database...");

  await prisma.issue.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123", 10);

  const seedUsers = [
    { username: "alex", name: "Alex Mercer", email: "alex@example.com", role: Role.ADMIN },
    { username: "niko", name: "Niko Alvarez", email: "niko@example.com", role: Role.DEVELOPER },
    { username: "priya", name: "Priya Patel", email: "priya@example.com", role: Role.DEVELOPER },
    { username: "marcus", name: "Marcus Reed", email: "marcus@example.com", role: Role.DEVELOPER },
    { username: "claire", name: "Claire Bennett", email: "claire@example.com", role: Role.CLIENT },
    { username: "owen", name: "Owen Brooks", email: "owen@example.com", role: Role.CLIENT },
    { username: "maya", name: "Maya Chen", email: "maya@example.com", role: Role.CLIENT },
  ] as const;

  const createdUsers = await Promise.all(
    seedUsers.map((user) =>
      prisma.user.create({
        data: {
          username: user.username,
          name: user.name,
          email: user.email,
          password: passwordHash,
          role: user.role,
          active: true,
          emailVerified: true,
        },
      })
    )
  );

  const usersByUsername = Object.fromEntries(createdUsers.map((u) => [u.username, u]));
  const admin = usersByUsername.alex;
  const developers = [usersByUsername.niko, usersByUsername.priya, usersByUsername.marcus];
  let issueTitleIndex = 0;

  const projects = await Promise.all(
    [
      {
        name: "Ishi Board Platform",
        description: "Core web experience, role controls, and board interactions",
      },
      {
        name: "Client Portal Refresh",
        description: "Client-facing dashboard and issue visibility improvements",
      },
      {
        name: "Identity and Access",
        description: "Auth workflows, verification, and session handling",
      },
      {
        name: "Operational Insights",
        description: "Health checks, diagnostics, and deployment reliability",
      },
    ].map((project, index) =>
      prisma.project.create({
        data: {
          ...project,
          ownerId: index % 2 === 0 ? admin.id : developers[index % developers.length].id,
        },
      })
    )
  );

  for (const project of projects) {
    await Promise.all(
      developers.map((developer) =>
        prisma.projectMember.create({
          data: { userId: developer.id, projectId: project.id },
        })
      )
    );
  }

  for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
    const project = projects[projectIndex];

    for (let statusIndex = 0; statusIndex < statuses.length; statusIndex += 1) {
      const status = statuses[statusIndex];
      const laneIssueCount = issueCountFor(projectIndex, statusIndex);

      for (let lanePosition = 0; lanePosition < laneIssueCount; lanePosition += 1) {
        const assignee = developers[(projectIndex + statusIndex + lanePosition) % developers.length];
        const priority = priorities[(projectIndex + statusIndex + lanePosition) % priorities.length];

        await prisma.issue.create({
          data: {
            projectId: project.id,
            assigneeId: assignee.id, // Issues are assigned to developers only.
            status,
            priority,
            title: issueTitleFor(issueTitleIndex++),
            description: `Seeded issue ${lanePosition + 1} for ${status} in ${project.name}.`,
          },
        });
      }
    }
  }

  console.log("Seed data created successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
