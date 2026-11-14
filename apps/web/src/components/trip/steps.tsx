import { Check, Loader2 } from "lucide-react";
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";

/* Progress that the visitor watches, not drives: ReUI's vertical Stepper with its triggers disabled.
   `done` steps are complete; the next one spins. */
export function ProgressSteps({ steps, done }: { steps: { title: string; sub?: string }[]; done: number }) {
  return (
    <Stepper
      value={Math.min(done + 1, steps.length + 1)}
      orientation="vertical"
      indicators={{ completed: <Check className="size-3.5" />, loading: <Loader2 className="size-3.5 animate-spin" /> }}
    >
      <StepperNav>
        {steps.map((s, i) => (
          <StepperItem key={s.title} step={i + 1} loading disabled className="relative items-start not-last:flex-1">
            <StepperTrigger className="items-start gap-3 pb-5 text-left last:pb-0 disabled:opacity-100">
              <StepperIndicator className="size-6 bg-white/[0.08] text-fg-2 data-[state=active]:bg-white/[0.12] data-[state=active]:text-fg data-[state=completed]:bg-paid data-[state=completed]:text-void" />
              <div className="mt-0.5 flex flex-col gap-1">
                <StepperTitle className="text-[14.5px] font-medium text-fg group-data-[state=inactive]/step:text-fg-3">{s.title}</StepperTitle>
                {s.sub && <StepperDescription className="text-[12px] text-fg-3">{s.sub}</StepperDescription>}
              </div>
            </StepperTrigger>
            {i < steps.length - 1 && (
              <StepperSeparator className="absolute inset-y-0 left-3 top-[calc(1.5rem+0.25rem)] -order-1 m-0 -translate-x-1/2 bg-white/10 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-1.5rem-0.5rem)] group-data-[state=completed]/step:bg-paid/60" />
            )}
          </StepperItem>
        ))}
      </StepperNav>
    </Stepper>
  );
}
