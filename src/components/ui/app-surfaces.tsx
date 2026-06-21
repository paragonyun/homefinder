import Link from "next/link";
import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

type ActionButtonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  tone?: "primary" | "secondary" | "quiet" | "danger";
  type?: "button" | "submit";
};

const actionToneClasses = {
  primary:
    "border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800 disabled:border-slate-300 disabled:bg-slate-300",
  secondary:
    "border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 disabled:border-slate-300 disabled:bg-slate-300",
  quiet:
    "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  danger:
    "border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:text-slate-400",
};

export function SurfacePanel({ children, className = "" }: Readonly<PanelProps>) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  action,
  description,
  eyebrow,
  title,
}: Readonly<SectionHeaderProps>) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ActionButton({
  children,
  className = "",
  disabled = false,
  href,
  onClick,
  tone = "primary",
  type = "button",
}: Readonly<ActionButtonProps>) {
  const classes = `inline-flex h-10 w-full items-center justify-center rounded-md border px-4 text-sm font-semibold transition sm:w-auto ${actionToneClasses[tone]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  children,
  className = "",
}: Readonly<PanelProps>) {
  return (
    <p
      className={`rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600 ${className}`}
    >
      {children}
    </p>
  );
}
