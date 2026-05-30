"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Check, Info, Undo2, CalendarClock, MessageSquare, EyeOff, ShieldCheck, Inbox,
} from "lucide-react";
import { AvatarStack } from "@/components/avatar";
import { cn } from "@/lib/utils";

type AssigneeState = "pending" | "awaiting_approval" | "done";

export type SwipeTask = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "awaiting_approval" | "completed";
  dueDate: string | null;
  commentCount: number;
  effectiveVisible: boolean;
  effectiveApproval: boolean;
  assigner: { id: string; username: string };
  assignees: { id: string; username: string; state: AssigneeState }[];
  myState: AssigneeState | null;
  subtasks: {
    id: string;
    title: string;
    myDone: boolean;
    iAmAssigned: boolean;
    fullyDone: boolean;
    effectiveAssignees: { id: string; username: string }[];
  }[];
};

type Action = "done" | "skip";

interface Props {
  tasks: SwipeTask[];
  currentUserId: string | null;
  onMarkDone: (taskId: string) => Promise<void> | void;
  onOpenDetails: (taskId: string) => void;
}

export function TaskSwipeCards({ tasks, currentUserId, onMarkDone, onOpenDetails }: Props) {
  const [index, setIndex] = useState(0);
  const [flyingAction, setFlyingAction] = useState<Action | null>(null);

  // Reset if task list changes meaningfully
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, tasks.length - 1)));
  }, [tasks.length]);

  if (tasks.length === 0) {
    return <EmptyCard text="No tasks here." />;
  }
  if (index >= tasks.length) {
    return (
      <EmptyCard
        text="You're at the end."
        action={
          <button
            onClick={() => setIndex(0)}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Undo2 className="h-3.5 w-3.5" /> Start over
          </button>
        }
      />
    );
  }

  const top = tasks[index];
  const next = tasks[index + 1];
  const after = tasks[index + 2];

  async function commit(action: Action) {
    setFlyingAction(action);
    if (action === "done") {
      await onMarkDone(top.id);
    }
    // Let the fly animation play out
    setTimeout(() => {
      setIndex((i) => i + 1);
      setFlyingAction(null);
    }, 260);
  }

  const canMarkDone = !!currentUserId
    && top.assignees.some((a) => a.id === currentUserId)
    && top.myState !== "done";

  return (
    <div className="space-y-5">
      <div className="relative h-[420px] sm:h-[460px]">
        {after && <BackgroundCard depth={2} task={after} />}
        {next && <BackgroundCard depth={1} task={next} />}
        <SwipeCard
          key={top.id}
          task={top}
          currentUserId={currentUserId}
          flying={flyingAction}
          canMarkDone={canMarkDone}
          onCommit={commit}
        />
      </div>

      <div className="flex items-center justify-center gap-4">
        <ActionButton variant="skip" onClick={() => commit("skip")} ariaLabel="Skip" />
        <ActionButton variant="info" onClick={() => onOpenDetails(top.id)} ariaLabel="Open details" />
        <ActionButton
          variant="done"
          onClick={() => canMarkDone && commit("done")}
          disabled={!canMarkDone}
          ariaLabel="Mark done"
        />
      </div>

      <div className="text-center text-[11px] text-muted-foreground">
        {index + 1} of {tasks.length} · swipe or tap below
      </div>
    </div>
  );
}

function SwipeCard({
  task,
  currentUserId,
  flying,
  canMarkDone,
  onCommit,
}: {
  task: SwipeTask;
  currentUserId: string | null;
  flying: Action | null;
  canMarkDone: boolean;
  onCommit: (a: Action) => void;
}) {
  const [dx, setDx] = useState(0);
  const dragRef = useRef<{ startX: number; active: boolean }>({ startX: 0, active: false });

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { startX: e.clientX, active: true };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    setDx(e.clientX - dragRef.current.startX);
  }
  function onPointerUp() {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const threshold = 110;
    if (dx > threshold) {
      if (canMarkDone) onCommit("done");
      else setDx(0);
    } else if (dx < -threshold) {
      onCommit("skip");
    } else {
      setDx(0);
    }
  }

  const rotation = dx * 0.04;
  const opacityRight = Math.min(1, Math.max(0, dx / 110));
  const opacityLeft = Math.min(1, Math.max(0, -dx / 110));

  let transform = `translateX(${dx}px) rotate(${rotation}deg)`;
  let transition = dragRef.current.active ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1), opacity 260ms";
  let opacity: number | undefined;

  if (flying === "done") {
    transform = "translateX(120%) rotate(20deg)";
    opacity = 0;
  } else if (flying === "skip") {
    transform = "translateX(-120%) rotate(-20deg)";
    opacity = 0;
  }

  const overdue =
    task.dueDate && task.status !== "completed" && new Date(task.dueDate).getTime() < Date.now();
  const total = task.subtasks.length;
  const fullyDoneCount = task.subtasks.filter((s) => s.fullyDone).length;

  return (
    <div
      className="absolute inset-0 select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current.active = false;
        setDx(0);
      }}
      style={{
        transform,
        transition,
        opacity,
        touchAction: "pan-y",
        cursor: dragRef.current.active ? "grabbing" : "grab",
      }}
    >
      <div className="relative h-full rounded-3xl border-2 bg-card shadow-xl overflow-hidden flex flex-col">
        {/* Swipe hints */}
        <div
          className="absolute top-4 left-4 text-success rotate-[-12deg] border-2 border-success rounded-lg px-3 py-1 font-bold text-lg z-10 pointer-events-none"
          style={{ opacity: opacityRight }}
        >
          DONE
        </div>
        <div
          className="absolute top-4 right-4 text-destructive rotate-[12deg] border-2 border-destructive rounded-lg px-3 py-1 font-bold text-lg z-10 pointer-events-none"
          style={{ opacity: opacityLeft }}
        >
          SKIP
        </div>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <AvatarStack names={task.assignees.map((a) => a.username)} size="sm" max={4} />
            <StatusChip status={task.status} myState={task.myState} />
          </div>
          <h2 className="text-2xl font-bold leading-tight">{task.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">from @{task.assigner.username}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-3 scrollbar-thin space-y-4">
          {task.description ? (
            <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
              {task.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description.</p>
          )}

          {total > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Subtasks · {fullyDoneCount}/{total}
              </p>
              <ul className="space-y-1.5">
                {task.subtasks.slice(0, 6).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full border-2 grid place-items-center shrink-0",
                        s.fullyDone
                          ? "bg-success border-success text-white"
                          : s.myDone
                            ? "bg-primary/10 border-primary text-primary"
                            : "border-muted-foreground/30"
                      )}
                    >
                      {(s.fullyDone || s.myDone) && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <span className={cn(s.myDone && "line-through text-muted-foreground")}>{s.title}</span>
                  </li>
                ))}
                {task.subtasks.length > 6 && (
                  <li className="text-xs text-muted-foreground pl-6">
                    +{task.subtasks.length - 6} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Footer with badges */}
        <div className="px-6 py-4 border-t bg-muted/30 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium")}>
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDue(task.dueDate)}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {task.commentCount}
            </span>
          )}
          {!task.effectiveVisible && (
            <span className="inline-flex items-center gap-1">
              <EyeOff className="h-3.5 w-3.5" /> private
            </span>
          )}
          {task.effectiveApproval && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> approval
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BackgroundCard({ depth, task }: { depth: 1 | 2; task: SwipeTask }) {
  const scale = depth === 1 ? 0.96 : 0.92;
  const offset = depth === 1 ? 8 : 16;
  const opacity = depth === 1 ? 0.7 : 0.4;
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        transform: `translateY(${offset}px) scale(${scale})`,
        opacity,
      }}
    >
      <div className="h-full rounded-3xl border bg-card shadow-md overflow-hidden">
        <div className="px-6 pt-6">
          <p className="text-xl font-bold truncate">{task.title}</p>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  variant,
  onClick,
  ariaLabel,
  disabled,
}: {
  variant: "skip" | "info" | "done";
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const styles = {
    skip: "border-destructive/30 text-destructive hover:bg-destructive/10",
    info: "border-muted-foreground/30 text-muted-foreground hover:bg-accent",
    done: "border-success/30 text-success hover:bg-success/10",
  } as const;
  const Icon = variant === "skip" ? X : variant === "info" ? Info : Check;
  const size = variant === "info" ? "h-12 w-12" : "h-16 w-16";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "rounded-full border-2 bg-card shadow-sm grid place-items-center transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
        size,
        !disabled && styles[variant]
      )}
    >
      <Icon className={cn(variant === "info" ? "h-5 w-5" : "h-7 w-7")} strokeWidth={variant === "info" ? 2 : 2.5} />
    </button>
  );
}

function StatusChip({ status, myState }: { status: SwipeTask["status"]; myState: AssigneeState | null }) {
  // Prefer "my" state when relevant
  const effective: AssigneeState | SwipeTask["status"] =
    myState && myState !== "pending" ? myState : status;
  const meta =
    effective === "done" || effective === "completed"
      ? { label: "done", cls: "bg-success/10 text-success" }
      : effective === "awaiting_approval"
        ? { label: "awaiting", cls: "bg-primary/10 text-primary" }
        : effective === "in_progress"
          ? { label: "in progress", cls: "bg-warning/15 text-warning-foreground/80" }
          : { label: "pending", cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn(
      "shrink-0 text-[10px] font-medium uppercase tracking-wider rounded-full px-2 py-0.5",
      meta.cls
    )}>
      {meta.label}
    </span>
  );
}

function EmptyCard({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed bg-card/40 h-[420px] grid place-items-center text-center">
      <div>
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
          <Inbox className="h-5 w-5" />
        </div>
        <p className="text-sm">{text}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
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
