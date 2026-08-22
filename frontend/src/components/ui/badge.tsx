import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  qualified: "bg-violet-100 text-violet-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-rose-100 text-rose-700",
  open: "bg-cyan-100 text-cyan-700",
  won: "bg-emerald-100 text-emerald-700",
  hot: "bg-rose-100 text-rose-700",
};

export function Badge({
  children,
  variant = "new",
  className,
}: {
  children: React.ReactNode;
  variant?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variants[variant] || variants.new,
        className
      )}
    >
      {children}
    </span>
  );
}
