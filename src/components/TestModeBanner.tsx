import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TestModeBanner() {
  return (
    <div className="bg-warning/10 border-b border-warning/20 px-3 py-1.5 sticky top-0 z-[60]">
      <div className="container max-w-lg mx-auto flex items-center justify-center gap-1.5 text-center">
        <span className="text-[10px] sm:text-xs font-medium text-warning leading-tight">
          TEST MODE — Demo environment
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-warning hover:text-warning/80 transition-colors shrink-0">
              <Info className="w-3 h-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px] text-center">
            <p className="text-xs">
              All balances and transactions are simulated.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
