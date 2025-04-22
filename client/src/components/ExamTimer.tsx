import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface ExamTimerProps {
  initialSeconds: number;
  onTimeEnd: () => void;
}

export default function ExamTimer({ initialSeconds, onTimeEnd }: ExamTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((seconds) => seconds - 1);
      }, 1000);
    } else if (seconds === 0 && isActive) {
      setIsActive(false);
      onTimeEnd();
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, onTimeEnd]);

  // Format time as MM:SS
  const formatTime = () => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine color based on time left
  const getTimerColor = () => {
    if (seconds < 60) return "text-destructive"; // Red when less than 1 minute
    if (seconds < 300) return "text-amber-500"; // Amber when less than 5 minutes
    return "text-neutral-dark"; // Default color
  };

  return (
    <div className="exam-timer flex items-center bg-neutral-bg px-4 py-2 rounded-md">
      <Clock className={`h-5 w-5 ${getTimerColor()} mr-2`} />
      <span className={`font-semibold text-lg ${getTimerColor()}`}>
        {formatTime()}
      </span>
    </div>
  );
}
