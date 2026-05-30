import mongoose from "mongoose";
import { Notification, type NotificationType } from "@/models/Notification";

export async function createNotification(args: {
  recipient: mongoose.Types.ObjectId | string;
  actor?: mongoose.Types.ObjectId | string | null;
  type: NotificationType;
  teamId?: mongoose.Types.ObjectId | string | null;
  taskId?: mongoose.Types.ObjectId | string | null;
  text: string;
  url: string;
}) {
  const recipientId =
    typeof args.recipient === "string"
      ? new mongoose.Types.ObjectId(args.recipient)
      : args.recipient;

  if (
    args.actor &&
    recipientId.equals(
      typeof args.actor === "string" ? new mongoose.Types.ObjectId(args.actor) : args.actor
    )
  ) {
    return null;
  }

  return Notification.create({
    recipient: recipientId,
    actor: args.actor ?? null,
    type: args.type,
    team: args.teamId ?? null,
    task: args.taskId ?? null,
    text: args.text,
    url: args.url,
    read: false,
  });
}
