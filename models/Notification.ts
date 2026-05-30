import mongoose, { Schema, Model, models } from "mongoose";

export type NotificationType =
  | "task_assigned"
  | "task_completed"
  | "join_request"
  | "join_approved"
  | "join_rejected"
  | "task_comment";

export interface INotification {
  _id: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  actor?: mongoose.Types.ObjectId | null;
  type: NotificationType;
  team?: mongoose.Types.ObjectId | null;
  task?: mongoose.Types.ObjectId | null;
  text: string;
  url: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, required: true },
    team: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    text: { type: String, required: true },
    url: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ||
  mongoose.model<INotification>("Notification", NotificationSchema);
