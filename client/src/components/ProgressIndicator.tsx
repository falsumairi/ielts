import { Progress } from "@/components/ui/progress";

interface PassageProgressItem {
  index: number;
  answered: number;
  total: number;
}

interface ProgressIndicatorProps {
  progress: number;
  answered: number;
  total: number;
  passageProgress?: PassageProgressItem[];
}

export default function ProgressIndicator({
  progress,
  answered,
  total,
  passageProgress = [],
}: ProgressIndicatorProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">Progress</span>
        <span className="text-sm font-medium text-neutral-dark">
          {answered} of {total} questions answered
        </span>
      </div>
      <Progress value={progress} className="w-full h-2" />
      
      {passageProgress.length > 0 && (
        <div className="flex justify-between mt-2 text-xs text-neutral-dark">
          {passageProgress.map((item) => (
            <span key={item.index}>
              Passage {item.index}: {item.answered}/{item.total}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
