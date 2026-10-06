import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface PlaybackProgressProps {
  value: number;
  onValueChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
}

const PlaybackProgress = ({ value, onValueChange, ariaLabel, className }: PlaybackProgressProps) => (
  <Slider
    value={[value]}
    onValueChange={([nextValue]) => onValueChange(nextValue)}
    max={100}
    step={0.5}
    aria-label={ariaLabel}
    className={cn(
      "w-full [&_.slider-track]:h-[1.8px] [&_.slider-track]:bg-muted-foreground/20 [&_.slider-range]:bg-gradient-to-r [&_.slider-range]:from-gold [&_.slider-range]:via-gold-light [&_.slider-range]:to-gold [&_.slider-thumb]:h-[10px] [&_.slider-thumb]:w-[10px] [&_.slider-thumb]:border-0 [&_.slider-thumb]:bg-gold [&_.slider-thumb]:shadow-[0_0_6px_hsl(43_70%_53%/0.7)]",
      className,
    )}
  />
);

export default PlaybackProgress;