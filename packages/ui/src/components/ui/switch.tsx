import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
  "switch-root",
  "",
  {
    default: "default",
    size: {
      default: "default",
      sm: "sm",
    },
  }
)

const switchThumbVariants = cva(
  "switch-thumb",
  "",
  {
    default: "default",
    size: {
      default: "default",
      sm: "sm",
    },
  }
)

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(
  { className, size, ...props }, ref) => (
    <SwitchPrimitives.Root
      className={cn(switchVariants({ size }), className)}
      data-testid="service-toggle-switch"
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(switchThumbVariants({ size }))}
      {...props}
    />
  )
)
Switch.displayName = "Switch"

export { Switch }
