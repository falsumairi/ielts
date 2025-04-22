import { useState, useRef, useEffect } from "react";
import { Mic, StopCircle, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, audioUrl: string) => void;
  maxDuration?: number; // in seconds
}

export default function AudioRecorder({
  onRecordingComplete,
  maxDuration = 120, // 2 minutes default
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Start recording
  const startRecording = async () => {
    try {
      // Reset state
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);
      audioChunksRef.current = [];

      // Request permissions and get stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Set up event listeners
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        onRecordingComplete(audioBlob, url);

        // Stop tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

      // Set up timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => {
          const newTime = prevTime + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      toast({
        title: "Recording error",
        description: "Could not access the microphone. Please check permissions.",
        variant: "destructive",
      });
      console.error("Error starting recording:", error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Reset recording
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  // Play/pause the recorded audio
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Audio visualization (simplified)
  const renderAudioVisualization = () => {
    return (
      <div className="flex items-end h-16 space-x-1 justify-center">
        {Array.from({ length: 30 }).map((_, i) => {
          const height = isRecording
            ? `${20 + Math.random() * 80}%`
            : `${20 + Math.sin(i / 5) * 50}%`;
          return (
            <div
              key={i}
              className="w-1 bg-primary rounded-sm"
              style={{ height }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="font-bold text-lg mb-4">Recording</h2>
      
      {/* Recording Status */}
      <div className="bg-neutral-bg rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center">
          {isRecording && (
            <div className="w-3 h-3 bg-destructive rounded-full animate-pulse mr-2"></div>
          )}
          <span className="font-medium">
            {isRecording
              ? "Recording in progress..."
              : audioUrl
              ? "Recording complete"
              : "Ready to record"}
          </span>
        </div>
        <span className="text-neutral-dark font-medium">
          {formatTime(recordingTime)} 
          {!isRecording && maxDuration && ` / ${formatTime(maxDuration)}`}
        </span>
      </div>
      
      {/* Audio Visualization */}
      <div className="bg-neutral-bg h-24 rounded-lg mb-6 flex items-center justify-center overflow-hidden">
        {renderAudioVisualization()}
        <audio
          ref={audioRef}
          src={audioUrl || undefined}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
      
      {/* Controls */}
      <div className="flex justify-center space-x-4">
        {!isRecording && !audioUrl && (
          <Button
            onClick={startRecording}
            className="p-3 bg-primary text-white rounded-full hover:bg-primary/90 transition"
            size="icon"
            title="Start Recording"
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}
        
        {isRecording && (
          <Button
            onClick={stopRecording}
            className="p-3 bg-destructive text-white rounded-full hover:bg-destructive/90 transition"
            size="icon"
            title="Stop Recording"
          >
            <StopCircle className="h-6 w-6" />
          </Button>
        )}
        
        {audioUrl && (
          <>
            <Button
              onClick={togglePlayback}
              className="p-3 bg-neutral-bg rounded-full hover:bg-neutral-bg/70 transition"
              size="icon"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 text-neutral-dark" />
              ) : (
                <Play className="h-6 w-6 text-neutral-dark" />
              )}
            </Button>
            
            <Button
              onClick={resetRecording}
              className="p-3 bg-neutral-bg rounded-full hover:bg-neutral-bg/70 transition"
              size="icon"
              title="Reset"
            >
              <RotateCcw className="h-6 w-6 text-neutral-dark" />
            </Button>
          </>
        )}
      </div>
      
      <div className="mt-6 p-3 bg-neutral-bg rounded-lg flex items-start">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neutral-dark mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-neutral-dark">
          Speak clearly into your microphone. Your response will be recorded and evaluated by an examiner.
        </p>
      </div>
    </div>
  );
}
