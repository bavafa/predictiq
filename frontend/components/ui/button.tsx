import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// shadcn/ui Button, restyled with the PredictIQ tokens. 44px minimum touch target.
const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-brand bg-brand text-white hover:bg-brand-hover hover:border-brand-hover",
        outline: "border-input-edge bg-card text-ink hover:bg-subtle",
        onDark: "on-dark border-sidebar-muted bg-transparent text-sidebar-text hover:bg-sidebar-active",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} type={asChild ? undefined : type} className={cn(buttonVariants({ variant }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
