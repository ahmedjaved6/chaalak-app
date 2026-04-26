import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg px-4 py-2 font-medium transition-colors",
        variant === "primary" && "bg-black text-white hover:bg-gray-800",
        variant === "secondary" && "border border-gray-300 hover:bg-gray-50",
        variant === "ghost" && "hover:bg-gray-100",
        className
      )}
      {...props}
    />
  );
}
