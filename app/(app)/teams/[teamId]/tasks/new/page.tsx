"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Users, User as UserIcon, Eye, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Member = { id: string; username: string; email: string };
type TeamDetail = {
  id: string;
  role: "manager" | "reportee";
  manager: { id: string };
  members: Member[];
  defaultTasksVisible: boolean;
  defaultRequireApproval: boolean;
};

type DraftSubtask = { title: string; assigneeIds: string[] };

export default function NewTaskPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId;
  const router = useRouter();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subtasks, setSubtasks] = useState<DraftSubtask[]>([]);
  const [newSub, setNewSub] = useState("");
  const [visibility, setVisibility] = useState<boolean | null>(null);
  const [approval, setApproval] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/teams/${teamId}`)
      .then((r) => r.json())
      .then((d) => setTeam(d));
  }, [teamId]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addSub() {
    const v = newSub.trim();
    if (!v) return;
    setSubtasks((prev) => [...prev, { title: v, assigneeIds: [] }]);
    setNewSub("");
  }

  function toggleSubAssignee(idx: number, assigneeId: string) {
    setSubtasks((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              assigneeIds: s.assigneeIds.includes(assigneeId)
                ? s.assigneeIds.filter((x) => x !== assigneeId)
                : [...s.assigneeIds, assigneeId],
            }
          : s
      )
    );
  }

  function clearSubAssignees(idx: number) {
    setSubtasks((prev) => prev.map((s, i) => (i === idx ? { ...s, assigneeIds: [] } : s)));
  }

  function removeSub(idx: number) {
    setSubtasks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (assigneeIds.length === 0) {
      setError("Pick at least one assignee");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigneeIds,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate + "T23:59:59").toISOString() : null,
        visibleToTeam: visibility,
        requireApproval: approval,
        subtasks: subtasks.map((s) => ({ title: s.title, assigneeIds: s.assigneeIds })),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create task");
      return;
    }
    router.push(`/teams/${teamId}`);
    router.refresh();
  }

  if (!team) {
    return <div className="pt-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (team.role !== "manager") {
    return (
      <div className="max-w-md mx-auto space-y-4 pt-4">
        <p className="text-sm">Only the team manager can create tasks.</p>
        <Link href={`/teams/${teamId}`}>
          <Button variant="secondary" className="w-full">
            Back to team
          </Button>
        </Link>
      </div>
    );
  }

  const assignableMembers = team.members.filter((m) => m.id !== team.manager.id);
  // Subtask assignees must be a subset of the task's selected assignees
  const subtaskAssigneeOptions = assignableMembers.filter((m) => assigneeIds.includes(m.id));

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/teams/${teamId}`} className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to team
      </Link>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">New task</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Assign to ({assigneeIds.length})
          </Label>
          {assignableMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reportees yet. Approve someone first.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {assignableMembers.map((m) => {
                const selected = assigneeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAssignee(m.id)}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition flex items-center justify-between gap-3",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">@{m.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-5 shrink-0 rounded border flex items-center justify-center",
                        selected ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                      )}
                    >
                      {selected && <span className="text-xs leading-none">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Task name</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={140}
            placeholder="e.g. Draft Q3 launch plan"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Add context, links, acceptance criteria..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Due date (optional)</Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <ThreeWay
          icon={<Eye className="h-4 w-4" />}
          label="Visible to whole team"
          value={visibility}
          fallback={team.defaultTasksVisible}
          onChange={setVisibility}
        />
        <ThreeWay
          icon={<Shield className="h-4 w-4" />}
          label="Require manager approval"
          value={approval}
          fallback={team.defaultRequireApproval}
          onChange={setApproval}
        />

        <div className="space-y-2">
          <Label>Subtasks</Label>
          <div className="flex gap-2">
            <Input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSub();
                }
              }}
              placeholder="Add a subtask"
            />
            <Button type="button" onClick={addSub} size="icon" variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {subtasks.length > 0 && (
            <ul className="space-y-2 pt-1">
              {subtasks.map((s, i) => (
                <li key={i} className="rounded-lg bg-muted/60 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm flex-1 break-words">{s.title}</p>
                    <button
                      type="button"
                      onClick={() => removeSub(i)}
                      className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                      <UserIcon className="h-3 w-3" /> Owners
                    </span>
                    <button
                      type="button"
                      onClick={() => clearSubAssignees(i)}
                      className={cn(
                        "text-xs rounded-full px-2 py-1 border transition",
                        s.assigneeIds.length === 0
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background text-muted-foreground"
                      )}
                    >
                      Everyone on task
                    </button>
                    {subtaskAssigneeOptions.length === 0 && assigneeIds.length === 0 && (
                      <span className="text-xs text-muted-foreground">Pick task assignees first</span>
                    )}
                    {subtaskAssigneeOptions.map((m) => {
                      const sel = s.assigneeIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleSubAssignee(i, m.id)}
                          className={cn(
                            "text-xs rounded-full px-2 py-1 border transition",
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
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={
            loading ||
            assigneeIds.length === 0 ||
            title.trim().length === 0 ||
            assignableMembers.length === 0
          }
        >
          {loading ? "Creating..." : "Create task"}
        </Button>
      </form>
    </div>
  );
}

function ThreeWay({
  icon,
  label,
  value,
  fallback,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean | null;
  fallback: boolean;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {icon} {label}
      </Label>
      <div className="inline-flex w-full rounded-full bg-muted p-1">
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
                "flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition",
                selected ? "bg-background shadow-sm" : "text-muted-foreground"
              )}
            >
              {isInherit ? `default (${fallback ? "on" : "off"})` : lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}
