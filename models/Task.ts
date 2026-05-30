import mongoose, { Schema, Model, models } from "mongoose";

export type AssigneeState = "pending" | "awaiting_approval" | "done";
export type TaskStatus = "pending" | "in_progress" | "awaiting_approval" | "completed";

export interface ISubtaskCompletion {
  user: mongoose.Types.ObjectId;
  done: boolean;
  doneAt?: Date | null;
}

export interface ISubtask {
  _id: mongoose.Types.ObjectId;
  title: string;
  assignees: mongoose.Types.ObjectId[];
  completions: ISubtaskCompletion[];
}

export interface IAssigneeState {
  user: mongoose.Types.ObjectId;
  state: AssigneeState;
}

export interface IComment {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
}

export interface ITask {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  assigner: mongoose.Types.ObjectId;
  assignees: mongoose.Types.ObjectId[];
  assigneeStates: IAssigneeState[];
  title: string;
  description?: string;
  subtasks: ISubtask[];
  comments: IComment[];
  dueDate?: Date | null;
  visibleToTeam?: boolean | null;
  requireApproval?: boolean | null;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SubtaskCompletionSchema = new Schema<ISubtaskCompletion>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: false }
);

const SubtaskSchema = new Schema<ISubtask>(
  {
    title: { type: String, required: true, trim: true },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    completions: { type: [SubtaskCompletionSchema], default: [] },
  },
  { _id: true }
);

const AssigneeStateSchema = new Schema<IAssigneeState>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    state: {
      type: String,
      enum: ["pending", "awaiting_approval", "done"],
      default: "pending",
    },
  },
  { _id: false }
);

const CommentSchema = new Schema<IComment>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const TaskSchema = new Schema<ITask>(
  {
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    assigner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignees: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: [(v: unknown[]) => Array.isArray(v) && v.length > 0, "At least one assignee"],
      index: true,
    },
    assigneeStates: { type: [AssigneeStateSchema], default: [] },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    subtasks: { type: [SubtaskSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    dueDate: { type: Date, default: null },
    visibleToTeam: { type: Boolean, default: null },
    requireApproval: { type: Boolean, default: null },
    status: {
      type: String,
      enum: ["pending", "in_progress", "awaiting_approval", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Task: Model<ITask> = (models.Task as Model<ITask>) || mongoose.model<ITask>("Task", TaskSchema);
