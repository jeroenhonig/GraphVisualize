import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
  showTooltip?: boolean;
}

export function TruncatedText({ 
  text, 
  maxLength = 30, 
  className = "", 
  showTooltip = true 
}: TruncatedTextProps) {
  const [isHovered, setIsHovered] = useState(false);
  const shouldTruncate = text.length > maxLength;
  const displayText = shouldTruncate ? text.substring(0, maxLength) + '...' : text;

  if (!shouldTruncate || !showTooltip) {
    return <span className={className}>{displayText}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={`cursor-help ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {displayText}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs break-words">
            {text}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}