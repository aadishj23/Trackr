import { CheckCircle2, Users, Bell, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex">
      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 md:px-10 safe-pt safe-pb">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      {/* Marketing side (desktop only) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center bg-gradient-to-br from-primary/10 via-background to-background border-l px-12">
        <div className="max-w-md space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold text-lg">
                T
              </div>
              <span className="text-xl font-bold tracking-tight">Trackr</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Tasks for your team, <span className="text-primary">without the bloat.</span>
            </h2>
            <p className="text-muted-foreground mt-3">
              Built for internal teams who want to assign, track, and ship together.
            </p>
          </div>

          <ul className="space-y-3">
            <Feature icon={<Users className="h-4 w-4" />} title="Multi-assignee tasks" desc="Split work across people with per-person progress." />
            <Feature icon={<ShieldCheck className="h-4 w-4" />} title="Approval flow" desc="Optional manager approval before tasks complete." />
            <Feature icon={<Bell className="h-4 w-4" />} title="Live notifications" desc="Know when your share is needed, approved, or commented on." />
            <Feature icon={<CheckCircle2 className="h-4 w-4" />} title="Subtasks with owners" desc="Each subtask can be assigned individually." />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}
