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
      "w-full [&_[class*=Track]]:h-1 [&_[class*=Track]]:bg-muted-foreground/20 [&_[class*=Range]]:bg-gradient-to-r [&_[class*=Range]]:from-gold [&_[class*=Range]]:via-gold-light [&_[class*=Range]]:to-gold [&_[class*=Thumb]]:h-[5.6px] [&_[class*=Thumb]]:w-[5.6px] [&_[class*=Thumb]]:border-0 [&_[class*=Thumb]]:bg-gold [&_[class*=Thumb]]:shadow-[0_0_6px_hsl(43_70%_53%/0.6)]",
      className,
    )}
  />
);

export default PlaybackProgress;