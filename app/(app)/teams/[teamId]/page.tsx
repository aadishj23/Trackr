"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Check, X, Copy, Pencil, Trash2, LogOut, MessageSquare, Send, CalendarClock, Users,
  Eye, EyeOff, Shield, ShieldCheck, Settings as SettingsIcon, ArrowRightLeft, MoreHorizontal, Inbox,
  List, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarStack } from "@/components/avatar";
import { TaskSwipeCards } from "@/components/task-swipe-cards";
import { cn } from "@/lib/utils";

type Member = { id: string; username: string; email: string };
type TeamDetail = {
  id: string;
  name: string;
  code: string;
  role: "manager" | "reportee";
  manager: { id: string; username: string };
  members: Member[];
  pendingRequests: Member[];
  defaultTasksVisible: boolean;
  defaultRequireApproval: boolean;
};

type AssigneeState = "pending" | "awaiting_approval" | "done";
type TaskItem = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "awaiting_approval" | "completed";
  dueDate: string | null;
  commentCount: number;
  visibleToTeam: boolean | null;
  requireApproval: boolean | null;
  effectiveVisible: boolean;
  effectiveApproval: boolean;
  assigner: { id: string; username: string };
  assignees: { id: string; username: string; state: AssigneeState }[];
  myState: AssigneeState | null;
  subtasks: {
    id: string;
    title: string;
    assignees: { id: string; username: string }[];
    effectiveAssignees: { id: string; username: string }[];
    completedBy: string[];
    myDone: boolean;
    iAmAssigned: boolean;
    fullyDone: boolean;
  }[];
};

export default function TeamPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const teamId = params.teamId;
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [view, setView] = useState<"list" | "cards">("list");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  // Restore preferred view from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("trackr-task-view");
    if (stored === "cards" || stored === "list") setView(stored);
  }, []);

  function changeView(v: "list" | "cards") {
    setView(v);
    if (typeof window !== "undefined") window.localStorage.setItem("trackr-task-view", v);
  }

  const load = useCallback(async () => {
    const [tRes, kRes, sRes] = await Promise.all([
      fetch(`/api/teams/${teamId}`),
      fetch(`/api/teams/${teamId}/tasks?scope=${scope}`),
      fetch(`/api/auth/session`),
    ]);
    if (tRes.ok) setTeam(await tRes.json());
    if (kRes.ok) setTasks((await kRes.json()).tasks);
    if (sRes.ok) {
      const s = await sRes.json();
      setCurrentUserId(s?.user?.id ?? null);
    }
  }, [teamId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (team && scope === "mine" && team.role === "manager") setScope("all");
  }, [team, scope]);

  async function saveRename() {
    if (!editName.trim() || editName.trim() === team?.name) {
      setEditing(false);
      return;
    }
    await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditing(false);
    load();
  }

  async function deleteTeam() {
    if (!confirm("Delete this team? All its tasks will be lost.")) return;
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
  }

  async function leaveTeam() {
    if (!confirm("Leave this team?")) return;
    const res = await fetch(`/api/teams/${teamId}/leave`, { method: "POST" });
    if (res.ok) router.push("/dashboard");
  }

  if (!team) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted/60 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="md:hidden inline-flex items-center text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
      </Link>

      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <Avatar name={team.name} size="lg" className="shrink-0" />
          {editing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={60}
                onKeyDown={(e) => e.key === "Enter" && saveRename()}
              />
              <Button size="sm" onClick={saveRename}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {team.role === "manager" ? "Managing" : "Member"}
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold truncate">{team.name}</h1>
                {team.role === "manager" && (
                  <button
                    onClick={() => { setEditName(team.name); setEditing(true); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition"
                    aria-label="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {team.role === "manager" && (
          <Link href={`/teams/${teamId}/tasks/new`} className="hidden md:inline-flex">
            <Button size="default">
              <Plus className="h-4 w-4" /> New task
            </Button>
          </Link>
        )}
      </header>

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main column: tasks */}
        <section className="space-y-4 min-w-0 order-2 lg:order-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-semibold">Tasks</h2>
            <div className="flex items-center gap-2">
              {team.role !== "manager" && (
                <div className="inline-flex rounded-full bg-muted p-1">
                  {(["mine", "all"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium capitalize transition",
                        scope === s ? "bg-card shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      {s === "mine" ? "Mine" : "All"}
                    </button>
                  ))}
                </div>
              )}
              <div className="inline-flex rounded-full bg-muted p-1">
                <button
                  onClick={() => changeView("list")}
                  className={cn(
                    "h-7 w-7 rounded-full grid place-items-center transition",
                    view === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                  aria-label="List view"
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => changeView("cards")}
                  className={cn(
                    "h-7 w-7 rounded-full grid place-items-center transition",
                    view === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                  aria-label="Card view"
                  title="Swipeable cards"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              </div>
              {team.role === "manager" && (
                <Link href={`/teams/${teamId}/tasks/new`} className="md:hidden">
                  <Button size="sm" className="h-8">
                    <Plus className="h-3.5 w-3.5" /> New
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {tasks === null ? (
            <TaskListSkeleton />
          ) : tasks.length === 0 ? (
            <EmptyTasks
              isManager={team.role === "manager"}
              teamId={teamId}
              scope={scope}
            />
          ) : view === "cards" ? (
            <TaskSwipeCards
              tasks={tasks}
              currentUserId={currentUserId}
              onMarkDone={async (taskId) => {
                await fetch(`/api/teams/${teamId}/tasks/${taskId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ markSelf: "done" }),
                });
                await load();
              }}
              onOpenDetails={(taskId) => {
                changeView("list");
                setFocusedTaskId(taskId);
                // Scroll into view next tick
                setTimeout(() => {
                  document.getElementById(`task-${taskId}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }, 100);
              }}
            />
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  teamId={teamId}
                  task={t}
                  onChange={load}
                  currentRole={team.role}
                  currentUserId={currentUserId}
                  teamMembers={team.members}
                  managerId={team.manager.id}
                  defaultExpanded={focusedTaskId === t.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Sidebar column: code, settings, members, danger */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start order-1 lg:order-2">
          <CodeChip code={team.code} />

          {team.role === "manager" && team.pendingRequests.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">Pending requests</p>
                <span className="text-xs text-muted-foreground">{team.pendingRequests.length}</span>
              </div>
              <div className="divide-y">
                {team.pendingRequests.map((u) => (
                  <PendingRow key={u.id} teamId={teamId} user={u} onDone={load} />
                ))}
              </div>
            </Card>
          )}

          {team.role === "manager" && (
            <TeamSettings teamId={teamId} team={team} onChanged={load} />
          )}

          <Card>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm font-semibold">Members</p>
              <span className="text-xs text-muted-foreground">{team.members.length}</span>
            </div>
            <div className="divide-y">
              {team.members.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <Avatar name={m.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">@{m.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  {m.id === team.manager.id && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                      mgr
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {team.role === "manager" ? (
            <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={deleteTeam}>
              <Trash2 className="h-4 w-4" /> Delete team
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={leaveTeam}>
              <LogOut className="h-4 w-4" /> Leave team
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="w-full rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-4 flex items-center justify-between hover:border-primary/30 transition"
    >
      <div className="text-left">
        <p className="text-xs text-muted-foreground">Team code</p>
        <p className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground mt-0.5">{code}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copied!" : "Copy"}
      </span>
    </button>
  );
}

function EmptyTasks({ isManager, teamId, scope }: { isManager: boolean; teamId: string; scope: "mine" | "all" }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/40 p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="font-medium">No tasks here</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        {isManager
          ? "Create the first task and assign it to your team."
          : scope === "mine"
            ? "Nothing's assigned to you yet."
            : "Nothing in this team yet."}
      </p>
      {isManager && (
        <Link href={`/teams/${teamId}/tasks/new`}>
          <Button>
            <Plus className="h-4 w-4" /> New task
          </Button>
        </Link>
      )}
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl border bg-card/40 animate-pulse" />
      ))}
    </div>
  );
}

function PendingRow({
  teamId,
  user,
  onDone,
}: {
  teamId: string;
  user: Member;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  async function decide(action: "approve" | "reject") {
    setBusy(action);
    await fetch(`/api/teams/${teamId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action }),
    });
    setBusy(null);
    onDone();
  }
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <Avatar name={user.username} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">@{user.username}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          disabled={!!busy}
          onClick={() => decide("reject")}
          className="h-8 w-8 rounded-lg border hover:bg-accent text-muted-foreground grid place-items-center transition disabled:opacity-50"
          aria-label="Reject"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          disabled={!!busy}
          onClick={() => decide("approve")}
          className="h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 grid place-items-center transition disabled:opacity-50"
          aria-label="Approve"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TaskCard({
  teamId,
  task,
  onChange,
  currentRole,
  currentUserId,
  teamMembers,
  managerId,
  defaultExpanded = false,
}: {
  teamId: string;
  task: TaskItem;
  onChange: () => void;
  currentRole: "manager" | "reportee";
  currentUserId: string | null;
  teamMembers: Member[];
  managerId: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showSettings, setShowSettings] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferIds, setTransferIds] = useState<string[]>(task.assignees.map((a) => a.id));
  const total = task.subtasks.length;
  const fullyDoneCount = task.subtasks.filter((s) => s.fullyDone).length;
  const myAssignedSubs = task.subtasks.filter((s) => s.iAmAssigned);
  const myDoneCount = myAssignedSubs.filter((s) => s.myDone).length;
  const myProgressPct =
    myAssignedSubs.length === 0
      ? task.myState === "done" ? 100 : 0
      : Math.round((myDoneCount / myAssignedSubs.length) * 100);
  const teamProgressPct =
    total === 0
      ? task.status === "completed" ? 100 : 0
      : Math.round((fullyDoneCount / total) * 100);
  const overdue =
    task.dueDate && task.status !== "completed" && new Date(task.dueDate).getTime() < Date.now();

  const isManager = currentRole === "manager";
  const isAssignee = !!currentUserId && task.assignees.some((a) => a.id === currentUserId);
  const progressPct = isAssignee ? myProgressPct : teamProgressPct;

  async function toggleSub(subId: string, next: boolean, targetUserId?: string) {
    const payload: { id: string; done: boolean; userId?: string } = { id: subId, done: next };
    if (targetUserId) payload.userId = targetUserId;
    await fetch(`/api/teams/${teamId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtasks: [payload] }),
    });
    onChange();
  }

  async function markSelf(state: "done" | "pending") {
    await fetch(`/api/teams/${teamId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markSelf: state }),
    });
    onChange();
  }

  async function decide(action: "approve" | "reject", userId: string) {
    await fetch(`/api/teams/${teamId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [action]: { userId } }),
    });
    onChange();
  }

  async function setOverride(field: "visibleToTeam" | "requireApproval", value: boolean | null) {
    await fetch(`/api/teams/${teamId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    onChange();
  }

  async function saveTransfer() {
    if (transferIds.length === 0) return;
    await fetch(`/api/teams/${teamId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeIds: transferIds }),
    });
    setTransferring(false);
    onChange();
  }

  async function deleteTask() {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/teams/${teamId}/tasks/${task.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <Card id={`task-${task.id}`} className="overflow-hidden transition hover:shadow-sm">
      <button
        className="w-full text-left p-4 md:p-5 focus:outline-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <StatusDot status={task.status} />
              <p className={cn(
                "font-semibold truncate",
                task.status === "completed" && "line-through text-muted-foreground"
              )}>
                {task.title}
              </p>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pl-4">
              {total > 0 && (
                <span>{fullyDoneCount}/{total} subtasks</span>
              )}
              {task.dueDate && (
                <span className={cn(
                  "inline-flex items-center gap-1",
                  overdue && "text-destructive font-medium"
                )}>
                  <CalendarClock className="h-3 w-3" />
                  {formatDue(task.dueDate)}
                </span>
              )}
              {task.commentCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {task.commentCount}
                </span>
              )}
              {!task.effectiveVisible && isManager && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <EyeOff className="h-3 w-3" /> private
                </span>
              )}
              {task.effectiveApproval && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> approval
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AvatarStack names={task.assignees.map((a) => a.username)} size="xs" max={3} />
            <StatusPill status={task.status} />
          </div>
        </div>

        {(myAssignedSubs.length > 0 || task.myState) && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  progressPct === 100 ? "bg-success" : "bg-primary"
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{progressPct}%</span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 md:px-5 pb-5 -mt-1 space-y-4 border-t">
          <div className="pt-4 grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              {task.description && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {task.subtasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subtasks</p>
                  <ul className="space-y-1.5">
                    {task.subtasks.map((s) => (
                      <SubtaskRow
                        key={s.id}
                        sub={s}
                        currentUserId={currentUserId}
                        isManager={isManager}
                        onToggle={(uid, next) =>
                          uid ? toggleSub(s.id, next, uid) : toggleSub(s.id, next)
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}

              <Comments teamId={teamId} taskId={task.id} onCommentAdded={onChange} />
            </div>

            <div className="space-y-3">
              {(task.assignees.length > 1 || isManager) && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {task.assignees.length > 1 ? "Status by person" : "Assignee"}
                  </p>
                  <PerAssigneeStates
                    task={task}
                    isManager={isManager}
                    currentUserId={currentUserId}
                    onApprove={(uid) => decide("approve", uid)}
                    onReject={(uid) => decide("reject", uid)}
                  />
                </>
              )}

              {isAssignee && task.myState !== "done" && (
                <Button
                  size="sm"
                  className="w-full"
                  variant={task.myState === "awaiting_approval" ? "outline" : "default"}
                  onClick={() =>
                    task.myState === "awaiting_approval" ? markSelf("pending") : markSelf("done")
                  }
                >
                  {task.myState === "awaiting_approval"
                    ? "Cancel & reset progress"
                    : task.assignees.length > 1
                      ? task.effectiveApproval
                        ? "Submit my share"
                        : "Mark my share done"
                      : task.effectiveApproval
                        ? "Submit for approval"
                        : "Mark complete"}
                </Button>
              )}
              {isAssignee && task.myState === "done" && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => markSelf("pending")}>
                  {task.assignees.length > 1 ? "Reopen my share" : "Reopen"}
                </Button>
              )}

              {isManager && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowSettings((v) => !v)}
                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-between px-2 py-1.5"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <SettingsIcon className="h-3 w-3" /> Settings
                    </span>
                    <span>{showSettings ? "−" : "+"}</span>
                  </button>
                  {showSettings && (
                    <div className="space-y-3 rounded-lg bg-muted/30 p-3">
                      <TaskOverrideRow
                        label="Visible to team"
                        value={task.visibleToTeam}
                        effective={task.effectiveVisible}
                        onChange={(v) => setOverride("visibleToTeam", v)}
                      />
                      <TaskOverrideRow
                        label="Require approval"
                        value={task.requireApproval}
                        effective={task.effectiveApproval}
                        onChange={(v) => setOverride("requireApproval", v)}
                      />
                    </div>
                  )}

                  {transferring ? (
                    <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pick assignees</p>
                      <div className="flex flex-wrap gap-1.5">
                        {teamMembers.filter((m) => m.id !== managerId).map((m) => {
                          const sel = transferIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                setTransferIds((prev) =>
                                  prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                                )
                              }
                              className={cn(
                                "text-xs rounded-full px-2.5 py-1 border transition inline-flex items-center gap-1",
                                sel
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-input bg-background text-muted-foreground hover:bg-accent"
                              )}
                            >
                              @{m.username}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => {
                          setTransferring(false);
                          setTransferIds(task.assignees.map((a) => a.id));
                        }}>
                          Cancel
                        </Button>
                        <Button size="sm" className="flex-1 h-8" onClick={saveTransfer} disabled={transferIds.length === 0}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setTransferring(true)}
                      className="w-full text-left text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2 py-1.5"
                    >
                      <ArrowRightLeft className="h-3 w-3" /> Transfer / change assignees
                    </button>
                  )}

                  <button
                    onClick={deleteTask}
                    className="w-full text-left text-xs text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md"
                  >
                    <Trash2 className="h-3 w-3" /> Delete task
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function SubtaskRow({
  sub,
  currentUserId,
  isManager,
  onToggle,
}: {
  sub: TaskItem["subtasks"][number];
  currentUserId: string | null;
  isManager: boolean;
  onToggle: (userId: string | null, done: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const canTickMine = sub.iAmAssigned;
  return (
    <li className="rounded-lg bg-muted/30 hover:bg-muted/50 transition px-3 py-2 space-y-1.5">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={sub.myDone}
          onCheckedChange={(v) => canTickMine && onToggle(null, v)}
          disabled={!canTickMine}
        />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm", sub.myDone && "line-through text-muted-foreground")}>
            {sub.title}
          </p>
        </div>
        {sub.fullyDone && (
          <span className="text-[10px] text-success font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10">
            done
          </span>
        )}
        {isManager && sub.effectiveAssignees.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              aria-label="Manage subtask"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border bg-popover shadow-lg p-1.5 space-y-0.5">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Tick as</p>
                {sub.effectiveAssignees.map((a) => {
                  const done = sub.completedBy.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        onToggle(a.id, !done);
                        setOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent flex items-center justify-between"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={a.username} size="xs" />
                        @{a.username}
                      </span>
                      <span className={done ? "text-success" : "text-muted-foreground"}>
                        {done ? "✓" : "○"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-8">
        {sub.effectiveAssignees.map((a) => {
          const isMe = a.id === currentUserId;
          const done = sub.completedBy.includes(a.id);
          return (
            <span
              key={a.id}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border",
                done
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-input bg-background text-muted-foreground"
              )}
            >
              {done && <Check className="h-2.5 w-2.5" />}
              {isMe ? "you" : `@${a.username}`}
            </span>
          );
        })}
      </div>
    </li>
  );
}

function PerAssigneeStates({
  task,
  isManager,
  currentUserId,
  onApprove,
  onReject,
}: {
  task: TaskItem;
  isManager: boolean;
  currentUserId: string | null;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
}) {
  return (
    <div className="rounded-xl border divide-y bg-card">
      {task.assignees.map((a) => {
        const isMe = a.id === currentUserId;
        const stateMeta =
          a.state === "done"
            ? { label: "done", cls: "bg-success/10 text-success" }
            : a.state === "awaiting_approval"
              ? { label: "awaiting", cls: "bg-primary/10 text-primary" }
              : { label: "pending", cls: "bg-muted text-muted-foreground" };
        return (
          <div key={a.id} className="flex items-center gap-2 px-3 py-2">
            <Avatar name={a.username} size="xs" />
            <span className="text-xs font-medium flex-1 truncate">
              {isMe ? "You" : `@${a.username}`}
            </span>
            <span className={cn("text-[10px] rounded-full px-2 py-0.5", stateMeta.cls)}>
              {stateMeta.label}
            </span>
            {isManager && a.state === "awaiting_approval" && (
              <div className="flex gap-1">
                <button
                  onClick={() => onReject(a.id)}
                  className="text-[10px] h-6 px-2 rounded-md border hover:bg-accent"
                >
                  reject
                </button>
                <button
                  onClick={() => onApprove(a.id)}
                  className="text-[10px] h-6 px-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  approve
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusDot({ status }: { status: TaskItem["status"] }) {
  const cls =
    status === "completed"
      ? "bg-success"
      : status === "awaiting_approval"
        ? "bg-primary"
        : status === "in_progress"
          ? "bg-warning"
          : "bg-muted-foreground/30";
  return <span className={cn("h-2 w-2 rounded-full shrink-0", cls)} />;
}

function StatusPill({ status }: { status: TaskItem["status"] }) {
  const meta =
    status === "completed"
      ? { label: "done", cls: "bg-success/10 text-success" }
      : status === "in_progress"
        ? { label: "in progress", cls: "bg-warning/15 text-warning-foreground/80" }
        : status === "awaiting_approval"
          ? { label: "approval", cls: "bg-primary/10 text-primary" }
          : { label: "pending", cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn(
      "hidden sm:inline-flex shrink-0 text-[10px] font-medium uppercase tracking-wider rounded-full px-2 py-0.5",
      meta.cls
    )}>
      {meta.label}
    </span>
  );
}

function TeamSettings({
  teamId,
  team,
  onChanged,
}: {
  teamId: string;
  team: TeamDetail;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function set(field: "defaultTasksVisible" | "defaultRequireApproval", value: boolean) {
    setBusy(true);
    await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setBusy(false);
    onChanged();
  }

  return (
    <Card>
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-semibold">Team defaults</p>
      </div>
      <div className="p-4 space-y-3">
        <SettingToggle
          icon={team.defaultTasksVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          title="Tasks visible to team"
          description={team.defaultTasksVisible ? "Everyone sees all tasks" : "Only assignees see tasks"}
          checked={team.defaultTasksVisible}
          onChange={(v) => set("defaultTasksVisible", v)}
          disabled={busy}
        />
        <SettingToggle
          icon={team.defaultRequireApproval ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          title="Approval required"
          description={team.defaultRequireApproval ? "Manager approves completions" : "Reportees can mark done directly"}
          checked={team.defaultRequireApproval}
          onChange={(v) => set("defaultRequireApproval", v)}
          disabled={busy}
        />
      </div>
    </Card>
  );
}

function SettingToggle({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground pt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "shrink-0 inline-flex h-5 w-9 rounded-full transition relative",
        checked ? "bg-primary" : "bg-muted-foreground/30",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}

function TaskOverrideRow({
  label,
  value,
  effective,
  onChange,
}: {
  label: string;
  value: boolean | null;
  effective: boolean;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <div className="inline-flex w-full rounded-full bg-card border p-0.5">
        {([
          ["inherit", null],
          ["on", true],
          ["off", false],
        ] as const).map(([lbl, v]) => {
          const selected = value === v;
          const isInherit = v === null;
          return (
            <button
              key={lbl}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "flex-1 rounded-full px-2 py-1 text-[10px] font-medium capitalize transition",
                selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isInherit ? `auto (${effective ? "on" : "off"})` : lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Comments({
  teamId,
  taskId,
  onCommentAdded,
}: {
  teamId: string;
  taskId: string;
  onCommentAdded: () => void;
}) {
  type C = { id: string; body: string; createdAt: string; author: { username: string; name: string } };
  const [comments, setComments] = useState<C[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/teams/${teamId}/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []));
  }, [teamId, taskId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch(`/api/teams/${teamId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (res.ok) {
      const { comment } = await res.json();
      setComments((prev) => [...(prev ?? []), comment]);
      setBody("");
      onCommentAdded();
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Comments {comments && comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
      </p>
      {comments && comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.author.username} size="sm" />
              <div className="flex-1 rounded-xl bg-muted/40 px-3 py-2">
                <p className="text-xs">
                  <span className="font-semibold">{c.author.name}</span>{" "}
                  <span className="text-muted-foreground">@{c.author.username}</span>
                </p>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="flex gap-2 pt-1">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          maxLength={2000}
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={sending || !body.trim()} aria-label="Send" className="h-9 w-9 p-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function formatDue(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays === -1) return "1 day overdue";
  if (diffDays < 0) return `${-diffDays} days overdue`;
  if (diffDays < 7) return `Due in ${diffDays} days`;
  return `Due ${d.toLocaleDateString()}`;
}
