import {
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode
} from "react";

import { cn } from "@/lib/utils";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "light" | "ghost";
  size?: "sm" | "md";
  className?: string;
  asChild?: boolean;
} & ComponentPropsWithoutRef<"button">;

const styles = {
  primary:
    "border border-sky-100/24 bg-[linear-gradient(135deg,#9ad8fb_0%,#62b7e8_42%,#e28767_100%)] text-slate-950 shadow-[0_18px_40px_rgba(14,42,78,0.22)] hover:translate-y-[-1px] hover:brightness-105",
  secondary:
    "border border-white/14 bg-white/6 text-white hover:border-white/24 hover:bg-white/10",
  light:
    "border border-slate-900/12 bg-slate-900 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] hover:bg-slate-800 hover:border-slate-900/18",
  ghost: "bg-transparent text-white/80 hover:bg-white/8 hover:text-white"
};

const sizes = {
  sm: "px-4 py-2.5 text-sm",
  md: "px-5 py-3 text-sm"
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  asChild,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist/70 disabled:pointer-events-none disabled:opacity-55",
    styles[variant],
    sizes[size],
    className
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, {
      className: cn(classes, child.props.className)
    });
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
