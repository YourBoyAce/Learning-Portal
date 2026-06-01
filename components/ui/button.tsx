import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  `
  group/button
  btn-brand
  inline-flex
  shrink-0
  items-center
  justify-center
  border
  border-transparent
  bg-clip-padding
  whitespace-nowrap
  text-sm
  font-bold
  outline-none
  transition-all
  select-none
  focus-visible:ring-2
  disabled:pointer-events-none
  disabled:opacity-50
  [&_svg]:pointer-events-none
  [&_svg]:shrink-0
  [&_svg:not([class*='size-'])]:size-4
  `,
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-white hover:bg-[var(--color-accent-hover)]",

        outline:
          "border border-[var(--color-primary)] bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10",

        secondary:
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",

        ghost:
          "text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10",

        destructive:
          "bg-red-600 text-white hover:bg-red-700",

        link:
          "text-[var(--color-accent)] underline-offset-4 hover:underline",
      },

      size: {
        default:
          "h-10 px-5 py-2",

        xs:
          "h-7 px-3 text-xs",

        sm:
          "h-8 px-4 text-sm",

        lg:
          "h-11 px-6 text-base",

        icon:
          "size-10",

        "icon-xs":
          "size-7",

        "icon-sm":
          "size-8",

        "icon-lg":
          "size-12",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({
          variant,
          size,
          className,
        })
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };