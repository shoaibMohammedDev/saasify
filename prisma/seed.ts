import { PrismaClient, type TaskStatus, type TaskPriority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
}

function todayAt(hour: number = 10): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

interface SeedUser {
  name: string;
  email: string;
  password: string;
}

const USERS: SeedUser[] = [
  { name: "Demo User", email: "demo@acme.com", password: "demo1234" },
  { name: "Admin User", email: "admin@acme.com", password: "admin1234" },
  { name: "Sarah Chen", email: "sarah@acme.com", password: "member1234" },
  { name: "Mike Johnson", email: "mike@acme.com", password: "member1234" },
];

interface SeedTask {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeEmail: string | null; // null = unassigned
  dueDateOffset: number; // days from now (negative = past)
}

const PROJECTS: {
  name: string;
  description: string;
  teamName: string;
  creatorEmail: string;
  tasks: SeedTask[];
}[] = [
  {
    name: "Website Redesign",
    description:
      "Complete overhaul of the company website with modern design, improved performance, and better UX across all devices.",
    teamName: "Engineering",
    creatorEmail: "demo@acme.com",
    tasks: [
      { title: "Set up project repository", status: "DONE", priority: "LOW", assigneeEmail: "demo@acme.com", dueDateOffset: -14 },
      { title: "Design homepage mockup", status: "IN_REVIEW", priority: "HIGH", assigneeEmail: "sarah@acme.com", dueDateOffset: -2 },
      { title: "Implement responsive navigation", status: "IN_PROGRESS", priority: "MEDIUM", assigneeEmail: "demo@acme.com", dueDateOffset: 1 },
      { title: "Build contact form component", status: "TODO", priority: "MEDIUM", assigneeEmail: "mike@acme.com", dueDateOffset: 5 },
      { title: "Optimize images and assets", status: "TODO", priority: "LOW", assigneeEmail: null, dueDateOffset: 7 },
      { title: "Set up CI/CD pipeline", status: "IN_PROGRESS", priority: "HIGH", assigneeEmail: "demo@acme.com", dueDateOffset: 0 },
      { title: "Write integration tests", status: "TODO", priority: "MEDIUM", assigneeEmail: "admin@acme.com", dueDateOffset: 10 },
      { title: "Performance audit and optimization", status: "TODO", priority: "URGENT", assigneeEmail: null, dueDateOffset: -1 },
    ],
  },
  {
    name: "Mobile App MVP",
    description:
      "Build the first version of our mobile application for iOS and Android with core features and a polished onboarding experience.",
    teamName: "Engineering",
    creatorEmail: "demo@acme.com",
    tasks: [
      { title: "Define feature requirements", status: "DONE", priority: "HIGH", assigneeEmail: "demo@acme.com", dueDateOffset: -21 },
      { title: "Set up React Native project", status: "DONE", priority: "MEDIUM", assigneeEmail: "admin@acme.com", dueDateOffset: -18 },
      { title: "Design onboarding screens", status: "IN_REVIEW", priority: "HIGH", assigneeEmail: "sarah@acme.com", dueDateOffset: -1 },
      { title: "Build authentication flow", status: "IN_PROGRESS", priority: "URGENT", assigneeEmail: "demo@acme.com", dueDateOffset: 2 },
      { title: "Create dashboard UI", status: "IN_PROGRESS", priority: "MEDIUM", assigneeEmail: "sarah@acme.com", dueDateOffset: 5 },
      { title: "Implement push notifications", status: "TODO", priority: "HIGH", assigneeEmail: "mike@acme.com", dueDateOffset: 8 },
      { title: "Build settings page", status: "TODO", priority: "LOW", assigneeEmail: "admin@acme.com", dueDateOffset: 12 },
      { title: "API integration layer", status: "IN_PROGRESS", priority: "HIGH", assigneeEmail: "demo@acme.com", dueDateOffset: 3 },
      { title: "App store submission prep", status: "TODO", priority: "MEDIUM", assigneeEmail: null, dueDateOffset: 14 },
      { title: "Beta testing checklist", status: "TODO", priority: "LOW", assigneeEmail: null, dueDateOffset: 16 },
    ],
  },
  {
    name: "Brand Guidelines",
    description:
      "Establish a comprehensive brand identity system including colors, typography, logo usage, and visual standards.",
    teamName: "Design",
    creatorEmail: "admin@acme.com",
    tasks: [
      { title: "Competitor brand analysis", status: "DONE", priority: "MEDIUM", assigneeEmail: "sarah@acme.com", dueDateOffset: -10 },
      { title: "Define color palette", status: "DONE", priority: "HIGH", assigneeEmail: "sarah@acme.com", dueDateOffset: -7 },
      { title: "Typography selection", status: "IN_PROGRESS", priority: "MEDIUM", assigneeEmail: "admin@acme.com", dueDateOffset: 2 },
      { title: "Logo variations", status: "TODO", priority: "HIGH", assigneeEmail: "sarah@acme.com", dueDateOffset: 6 },
      { title: "Create brand book document", status: "TODO", priority: "URGENT", assigneeEmail: null, dueDateOffset: 4 },
    ],
  },
  {
    name: "Q4 Marketing Campaign",
    description:
      "Plan and execute the Q4 marketing campaign across social media, email, and landing pages to drive end-of-year conversions.",
    teamName: "Marketing",
    creatorEmail: "mike@acme.com",
    tasks: [
      { title: "Campaign strategy document", status: "DONE", priority: "HIGH", assigneeEmail: "mike@acme.com", dueDateOffset: -5 },
      { title: "Social media content plan", status: "IN_PROGRESS", priority: "MEDIUM", assigneeEmail: "mike@acme.com", dueDateOffset: 3 },
      { title: "Email newsletter templates", status: "TODO", priority: "MEDIUM", assigneeEmail: null, dueDateOffset: 7 },
      { title: "Landing page copy", status: "TODO", priority: "HIGH", assigneeEmail: null, dueDateOffset: 5 },
      { title: "Analytics setup", status: "TODO", priority: "LOW", assigneeEmail: "mike@acme.com", dueDateOffset: 10 },
      { title: "Budget allocation review", status: "IN_REVIEW", priority: "URGENT", assigneeEmail: "mike@acme.com", dueDateOffset: 0 },
    ],
  },
];

const TEAMS: { name: string; memberEmails: string[] }[] = [
  { name: "Engineering", memberEmails: ["demo@acme.com", "admin@acme.com", "sarah@acme.com", "mike@acme.com"] },
  { name: "Design", memberEmails: ["admin@acme.com", "sarah@acme.com"] },
  { name: "Marketing", memberEmails: ["mike@acme.com"] },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding database...\n");

  // ---- 1. Users (upsert by email) ----
  console.log("Creating users...");
  const userMap = new Map<string, number>(); // email → id

  for (const u of USERS) {
    const hashed = await hashPassword(u.password);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, password: hashed },
      create: { name: u.name, email: u.email, password: hashed },
    });
    userMap.set(u.email, user.id);
    console.log(`  ✓ ${u.name} (${u.email}) → id=${user.id}`);
  }

  // ---- 2. Organization (upsert by slug) ----
  console.log("\nCreating organization...");
  const org = await prisma.organization.upsert({
    where: { slug: "acme-agency" },
    update: {},
    create: {
      name: "Acme Agency",
      slug: "acme-agency",
      ownerId: userMap.get("demo@acme.com")!,
    },
  });
  console.log(`  ✓ ${org.name} (slug: ${org.slug}) → id=${org.id}`);

  // ---- 3. Members (upsert by userId+orgId) ----
  console.log("\nAdding members...");
  const memberRoles: [string, "OWNER" | "ADMIN" | "MEMBER"][] = [
    ["demo@acme.com", "OWNER"],
    ["admin@acme.com", "ADMIN"],
    ["sarah@acme.com", "MEMBER"],
    ["mike@acme.com", "MEMBER"],
  ];

  for (const [email, role] of memberRoles) {
    const userId = userMap.get(email)!;
    await prisma.member.upsert({
      where: { userId_orgId: { userId, orgId: org.id } },
      update: { role },
      create: { userId, orgId: org.id, role },
    });
    console.log(`  ✓ ${email} → ${role}`);
  }

  // ---- 4. Teams ----
  console.log("\nCreating teams...");
  const teamMap = new Map<string, number>(); // team name → id

  for (const teamDef of TEAMS) {
    // Check if team already exists for this org
    const existing = await prisma.team.findFirst({
      where: { orgId: org.id, name: teamDef.name },
    });

    let teamId: number;
    if (existing) {
      teamId = existing.id;
      console.log(`  ✓ ${teamDef.name} (already exists, id=${teamId})`);
    } else {
      const team = await prisma.team.create({
        data: { name: teamDef.name, orgId: org.id },
      });
      teamId = team.id;
      console.log(`  ✓ ${teamDef.name} → id=${teamId}`);
    }
    teamMap.set(teamDef.name, teamId);

    // Team members
    for (const email of teamDef.memberEmails) {
      const userId = userMap.get(email)!;
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId } },
        update: {},
        create: { teamId, userId },
      });
    }
    console.log(`    members: ${teamDef.memberEmails.join(", ")}`);
  }

  // ---- 5. Projects + Tasks ----
  console.log("\nCreating projects and tasks...");

  for (const projDef of PROJECTS) {
    const teamId = teamMap.get(projDef.teamName)!;
    const creatorId = userMap.get(projDef.creatorEmail)!;

    // Upsert project by name + orgId
    const project = await prisma.project.upsert({
      where: {
        // Use a unique field combo — there's no unique constraint on name+orgId,
        // so we'll check manually
        id: (
          await prisma.project.findFirst({
            where: { orgId: org.id, name: projDef.name },
            select: { id: true },
          })
        )?.id ?? -1,
      },
      update: { description: projDef.description, teamId, status: "ACTIVE" },
      create: {
        name: projDef.name,
        description: projDef.description,
        orgId: org.id,
        teamId,
        createdBy: creatorId,
        status: "ACTIVE",
      },
    });
    console.log(`  ✓ ${projDef.name} → id=${project.id} (${projDef.tasks.length} tasks)`);

    // Seed tasks (only if project was just created — check task count)
    const existingTaskCount = await prisma.task.count({
      where: { projectId: project.id },
    });

    if (existingTaskCount === 0) {
      for (let i = 0; i < projDef.tasks.length; i++) {
        const t = projDef.tasks[i];
        const assigneeId = t.assigneeEmail ? userMap.get(t.assigneeEmail) ?? null : null;
        const dueDate = daysFromNow(t.dueDateOffset);

        await prisma.task.create({
          data: {
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate,
            projectId: project.id,
            assigneeId,
            createdBy: creatorId,
            createdAt: daysAgo(7 - i), // stagger creation times
          },
        });
      }
      console.log(`    → ${projDef.tasks.length} tasks seeded`);
    } else {
      console.log(`    → ${existingTaskCount} tasks already exist, skipping`);
    }
  }

  // ---- 6. Activity Logs ----
  console.log("\nCreating activity logs...");

  const existingLogCount = await prisma.activityLog.count({
    where: { orgId: org.id },
  });

  if (existingLogCount > 0) {
    console.log(`  → ${existingLogCount} activity logs already exist, skipping`);
  } else {
    // Get the actual project/task IDs for activity log references
    const allProjects = await prisma.project.findMany({
      where: { orgId: org.id },
      include: { tasks: { orderBy: { id: "asc" } } },
    });

    const projIdByName = new Map(allProjects.map((p) => [p.name, p.id]));
    const firstTaskByProject = new Map(
      allProjects.map((p) => [p.name, p.tasks[0] ?? null])
    );
    const secondTaskByProject = new Map(
      allProjects.map((p) => [p.name, p.tasks[1] ?? null])
    );
    const lastTaskByProject = new Map(
      allProjects.map((p) => [p.name, p.tasks[p.tasks.length - 1] ?? null])
    );

    const logs: {
      action: string;
      description: string;
      userId: number;
      projectId?: number | null;
      taskId?: number | null;
      createdAt: Date;
    }[] = [
      // Day -7
      { action: "member.joined", description: "joined the organization", userId: userMap.get("admin@acme.com")!, createdAt: daysAgo(7) },
      { action: "project.created", description: `created project "Website Redesign"`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), createdAt: hoursAgo(7 * 24 - 1) },
      { action: "task.created", description: `created task "Set up project repository" in Website Redesign`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), taskId: firstTaskByProject.get("Website Redesign")?.id, createdAt: hoursAgo(7 * 24 - 0.5) },

      // Day -6
      { action: "member.joined", description: "joined the organization", userId: userMap.get("sarah@acme.com")!, createdAt: daysAgo(6) },
      { action: "member.joined", description: "joined the organization", userId: userMap.get("mike@acme.com")!, createdAt: new Date(daysAgo(6).getTime() + 3600000) },

      // Day -5
      { action: "project.created", description: `created project "Mobile App MVP"`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Mobile App MVP"), createdAt: daysAgo(5) },
      { action: "task.status_changed", description: `moved "Define feature requirements" to Done in Mobile App MVP`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Mobile App MVP"), taskId: firstTaskByProject.get("Mobile App MVP")?.id, createdAt: hoursAgo(5 * 24 + 1) },
      { action: "project.created", description: `created project "Q4 Marketing Campaign"`, userId: userMap.get("mike@acme.com")!, projectId: projIdByName.get("Q4 Marketing Campaign"), createdAt: new Date(daysAgo(5).getTime() + 7200000) },

      // Day -4
      { action: "task.status_changed", description: `moved "Set up React Native project" to Done in Mobile App MVP`, userId: userMap.get("admin@acme.com")!, projectId: projIdByName.get("Mobile App MVP"), taskId: secondTaskByProject.get("Mobile App MVP")?.id, createdAt: daysAgo(4) },
      { action: "task.created", description: `created task "Design homepage mockup" in Website Redesign`, userId: userMap.get("sarah@acme.com")!, projectId: projIdByName.get("Website Redesign"), taskId: secondTaskByProject.get("Website Redesign")?.id, createdAt: hoursAgo(4 * 24 + 2) },
      { action: "project.created", description: `created project "Brand Guidelines"`, userId: userMap.get("admin@acme.com")!, projectId: projIdByName.get("Brand Guidelines"), createdAt: new Date(daysAgo(4).getTime() + 7200000) },

      // Day -3
      { action: "task.assigned", description: `assigned "Implement responsive navigation" to Demo User in Website Redesign`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), createdAt: daysAgo(3) },
      { action: "task.status_changed", description: `moved "Competitor brand analysis" to Done in Brand Guidelines`, userId: userMap.get("sarah@acme.com")!, projectId: projIdByName.get("Brand Guidelines"), taskId: firstTaskByProject.get("Brand Guidelines")?.id, createdAt: hoursAgo(3 * 24 + 1) },
      { action: "task.status_changed", description: `moved "Campaign strategy document" to Done in Q4 Marketing Campaign`, userId: userMap.get("mike@acme.com")!, projectId: projIdByName.get("Q4 Marketing Campaign"), taskId: firstTaskByProject.get("Q4 Marketing Campaign")?.id, createdAt: new Date(daysAgo(3).getTime() + 3600000) },

      // Day -2
      { action: "task.created", description: `created task "Build authentication flow" in Mobile App MVP`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Mobile App MVP"), createdAt: daysAgo(2) },
      { action: "task.status_changed", description: `moved "Define color palette" to Done in Brand Guidelines`, userId: userMap.get("sarah@acme.com")!, projectId: projIdByName.get("Brand Guidelines"), taskId: secondTaskByProject.get("Brand Guidelines")?.id, createdAt: hoursAgo(2 * 24 + 2) },
      { action: "task.status_changed", description: `moved "Design homepage mockup" to In Review in Website Redesign`, userId: userMap.get("sarah@acme.com")!, projectId: projIdByName.get("Website Redesign"), taskId: secondTaskByProject.get("Website Redesign")?.id, createdAt: hoursAgo(2 * 24 + 3) },

      // Day -1
      { action: "task.status_changed", description: `moved "Design onboarding screens" to In Review in Mobile App MVP`, userId: userMap.get("sarah@acme.com")!, projectId: projIdByName.get("Mobile App MVP"), createdAt: daysAgo(1) },
      { action: "task.status_changed", description: `moved "Budget allocation review" to In Review in Q4 Marketing Campaign`, userId: userMap.get("mike@acme.com")!, projectId: projIdByName.get("Q4 Marketing Campaign"), taskId: lastTaskByProject.get("Q4 Marketing Campaign")?.id, createdAt: hoursAgo(24 + 2) },
      { action: "task.assigned", description: `assigned "Build contact form component" to Mike Johnson in Website Redesign`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), createdAt: hoursAgo(24 + 4) },

      // Today (last 12 hours)
      { action: "task.status_changed", description: `moved "Set up project repository" to Done in Website Redesign`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), taskId: firstTaskByProject.get("Website Redesign")?.id, createdAt: hoursAgo(10) },
      { action: "task.updated", description: `updated "Implement responsive navigation" in Website Redesign`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), createdAt: hoursAgo(8) },
      { action: "task.status_changed", description: `moved "Create dashboard UI" to In Progress in Mobile App MVP`, userId: userMap.get("sarah@acme.com")!, projectId: projIdByName.get("Mobile App MVP"), createdAt: hoursAgo(6) },
      { action: "task.status_changed", description: `moved "Social media content plan" to In Progress in Q4 Marketing Campaign`, userId: userMap.get("mike@acme.com")!, projectId: projIdByName.get("Q4 Marketing Campaign"), createdAt: hoursAgo(5) },
      { action: "task.status_changed", description: `moved "Typography selection" to In Progress in Brand Guidelines`, userId: userMap.get("admin@acme.com")!, projectId: projIdByName.get("Brand Guidelines"), createdAt: hoursAgo(4) },
      { action: "task.status_changed", description: `moved "Set up CI/CD pipeline" to In Progress in Website Redesign`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), createdAt: hoursAgo(3) },
      { action: "task.status_changed", description: `moved "API integration layer" to In Progress in Mobile App MVP`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Mobile App MVP"), createdAt: hoursAgo(2) },
      { action: "task.created", description: `created task "Performance audit and optimization" in Website Redesign`, userId: userMap.get("demo@acme.com")!, projectId: projIdByName.get("Website Redesign"), createdAt: hoursAgo(1) },
    ];

    // Insert in reverse chronological order to maintain IDs ascending with time
    for (const log of logs.reverse()) {
      await prisma.activityLog.create({
        data: {
          action: log.action,
          description: log.description,
          userId: log.userId,
          orgId: org.id,
          projectId: log.projectId ?? null,
          taskId: log.taskId ?? null,
          createdAt: log.createdAt,
        },
      });
    }

    console.log(`  → ${logs.length} activity logs seeded`);
  }

  // ---- Summary ----
  const totalUsers = await prisma.user.count();
  const totalOrgs = await prisma.organization.count();
  const totalTeams = await prisma.team.count({ where: { orgId: org.id } });
  const totalProjects = await prisma.project.count({ where: { orgId: org.id } });
  const totalTasks = await prisma.task.count({
    where: { project: { orgId: org.id } },
  });
  const totalActivities = await prisma.activityLog.count({
    where: { orgId: org.id },
  });

  console.log("\n✅ Seed completed successfully!");
  console.log(`
  Summary for "${org.name}":
  ├── Users:       ${totalUsers}
  ├── Teams:       ${totalTeams}
  ├── Projects:    ${totalProjects}
  ├── Tasks:       ${totalTasks}
  └── Activities:  ${totalActivities}
  `);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });