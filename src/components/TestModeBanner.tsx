import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TestModeBanner() {
  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2">
      <div className="container flex items-center justify-center gap-2 text-center">
        <span className="text-xs font-medium text-warning">
          TEST MODE — Demo environment. No real funds involved.
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-warning hover:text-warning/80 transition-colors">
              <Info className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px] text-center">
            <p className="text-xs">
              All balances and transactions are simulated for product testing.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
