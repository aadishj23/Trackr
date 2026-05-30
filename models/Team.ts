import mongoose, { Schema, Model, models } from "mongoose";

export interface ITeam {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  manager: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  pendingRequests: mongoose.Types.ObjectId[];
  defaultTasksVisible: boolean;
  defaultRequireApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, index: true },
    manager: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    pendingRequests: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    defaultTasksVisible: { type: Boolean, default: true },
    defaultRequireApproval: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Team: Model<ITeam> = (models.Team as Model<ITeam>) || mongoose.model<ITeam>("Team", TeamSchema);
