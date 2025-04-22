import * as React from "react"
import { OTPInput, SlotProps } from "input-otp"
import { cn } from "@/lib/utils"
import { Dot } from "lucide-react"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn("flex items-center gap-2", className)}
    {...props}
  />
))
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center gap-2", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  SlotProps & React.ComponentPropsWithoutRef<"div">
>(({ char, hasFakeCaret, isActive, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 items-center justify-center rounded-md border border-input text-sm shadow-sm transition-all",
      isActive && "ring-2 ring-primary ring-offset-background",
      className
    )}
    {...props}
  >
    {char ? (
      <div>{char}</div>
    ) : (
      <Dot className="h-4 w-4 text-muted-foreground" />
    )}
    {hasFakeCaret && (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="animate-caret h-4 w-0.5 bg-primary" />
      </div>
    )}
  </div>
))
InputOTPSlot.displayName = "InputOTPSlot"

export { InputOTP, InputOTPGroup, InputOTPSlot }