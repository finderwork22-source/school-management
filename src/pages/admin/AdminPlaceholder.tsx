import { Construction } from "lucide-react";

interface AdminPlaceholderProps {
  title: string;
  description: string;
}

export default function AdminPlaceholder({
  title,
  description,
}: AdminPlaceholderProps) {
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="rounded-2xl border border-wiser-border bg-white p-8 shadow-sm sm:p-10">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
          <Construction size={20} />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-wiser-text">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-wiser-text-secondary">
          {description}
        </p>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-wiser-text-muted">
          Module ready for the next development phase
        </p>
      </div>
    </div>
  );
}
