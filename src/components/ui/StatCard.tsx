import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Card from "./Card";

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
}

export default function StatCard({
  label,
  value,
  change,
  trend = "neutral",
  icon: Icon,
}: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon size={18} strokeWidth={1.8} />
        </div>

        {change && trend !== "neutral" && (
          <div
            className={[
              "flex items-center gap-0.5 text-xs font-medium",
              trend === "up"
                ? "text-emerald-600"
                : "text-red-600",
            ].join(" ")}
          >
            {trend === "up" ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}

            {change}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {label}
        </div>
      </div>
    </Card>
  );
}