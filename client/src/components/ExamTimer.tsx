import { useState, useEffect, useCallback } from "react";
import { Clock, Pause, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";

interface ExamTimerProps {
  initialSeconds: number;
  onTimeEnd: () => void;
  allowPause?: boolean;
  showProgress?: boolean;
  onTimeUpdate?: (remainingSeconds: number) => void;
}

export default function ExamTimer({ 
  initialSeconds, 
  onTimeEnd,
  allowPause = false,
  showProgress = true,
  onTimeUpdate
}: ExamTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  
  // Calculate percentage of time remaining
  const timePercentage = Math.round((seconds / initialSeconds) * 100);

  // Callback for handling time end
  const handleTimeEnd = useCallback(() => {
    setIsActive(false);
    onTimeEnd();
  }, [onTimeEnd]);

  // Toggle timer pause/resume
  const toggleTimer = () => {
    if (!allowPause) return;
    setIsActive(prev => !prev);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((prevSeconds) => {
          const newSeconds = prevSeconds - 1;
          
          // Notify parent of time update if callback provided
          if (onTimeUpdate) {
            onTimeUpdate(newSeconds);
          }
          
          // Show warning when less than 5 minutes remain
          if (newSeconds === 300) {
            setShowWarning(true);
            // Hide warning after 5 seconds
            setTimeout(() => setShowWarning(false), 5000);
          }
          
          // Show warning again when less than 1 minute remains
          if (newSeconds === 60) {
            setShowWarning(true);
            // Hide warning after 5 seconds
            setTimeout(() => setShowWarning(false), 5000);
          }
          
          return newSeconds;
        });
      }, 1000);
    } else if (seconds === 0 && isActive) {
      handleTimeEnd();
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, handleTimeEnd, onTimeUpdate]);

  // Format time as HH:MM:SS or MM:SS depending on duration
  const formatTime = () => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine color based on time left
  const getTimerColor = () => {
    if (seconds < 60) return "text-destructive"; // Red when less than 1 minute
    if (seconds < 300) return "text-amber-500"; // Amber when less than 5 minutes
    return "text-neutral-dark"; // Default color
  };
  
  // Determine progress bar color
  const getProgressColor = () => {
    if (timePercentage < 20) return "bg-destructive"; // Red when less than 20% time left
    if (timePercentage < 50) return "bg-amber-500"; // Amber when less than 50% time left
    return "bg-emerald-500"; // Green otherwise
  };

  return (
    <div className="exam-timer space-y-2">
      <div className="flex items-center justify-between bg-neutral-bg px-4 py-2 rounded-md">
        <div className="flex items-center">
          <Clock className={`h-5 w-5 ${getTimerColor()} mr-2`} />
          <span className={`font-semibold text-lg ${getTimerColor()}`}>
            {formatTime()}
          </span>
        </div>
        
        {allowPause && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleTimer}
                  className="ml-2 p-1 h-8 w-8"
                >
                  {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isActive ? "Pause timer" : "Resume timer"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {showProgress && (
        <Progress 
          value={timePercentage} 
          className="h-1.5" 
          indicatorClassName={getProgressColor()}
        />
      )}
      
      {showWarning && (
        <div className="flex items-center bg-destructive/10 text-destructive p-2 rounded-md mt-2 text-sm animate-pulse">
          <AlertCircle className="h-4 w-4 mr-2" />
          {seconds < 60 ? 
            "Less than 1 minute remaining!" : 
            "Less than 5 minutes remaining!"}
        </div>
      )}
    </div>
  );
}
