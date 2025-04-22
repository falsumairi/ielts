import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

interface AudioPlayerProps {
  audioUrl: string;
  allowReplay?: boolean;
  autoPlay?: boolean;
  onComplete?: () => void;
}

export default function AudioPlayer({
  audioUrl,
  allowReplay = false,
  autoPlay = false,
  onComplete
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  // Create a unique ID for this audio track to use in localStorage
  const [audioId] = useState(() => `audio-${audioUrl.split('/').pop()?.replace(/\.[^/.]+$/, '') || Math.random().toString(36).substring(2, 9)}`);
  
  // Check if this audio was already played before
  useEffect(() => {
    if (!allowReplay) {
      const playedAudios = JSON.parse(localStorage.getItem('played-audios') || '{}');
      if (playedAudios[audioId]) {
        setHasPlayed(true);
      }
    }
  }, [allowReplay, audioId]);
  
  // Mark audio as played in localStorage
  const markAudioAsPlayed = () => {
    if (!allowReplay) {
      const playedAudios = JSON.parse(localStorage.getItem('played-audios') || '{}');
      playedAudios[audioId] = true;
      localStorage.setItem('played-audios', JSON.stringify(playedAudios));
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Set up event listeners
    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setHasPlayed(true);
      markAudioAsPlayed();
      if (onComplete) onComplete();
      
      if (!allowReplay) {
        toast({
          title: "Audio completed",
          description: "You can only play this audio once during the exam.",
          variant: "default",
        });
      }
    };

    // Audio events
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    // Handle autoplay
    if (autoPlay && !hasPlayed) {
      audio.play().catch(e => {
        toast({
          title: "Autoplay blocked",
          description: "Please interact with the page to enable audio playback.",
          variant: "destructive",
        });
      });
      setIsPlaying(true);
      setHasPlayed(true);
      markAudioAsPlayed();
    }

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, autoPlay, allowReplay, hasPlayed, onComplete, toast, audioId]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!allowReplay && hasPlayed) {
      toast({
        title: "Playback restricted",
        description: "You can only play this audio once during the exam.",
        variant: "destructive",
      });
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => {
        toast({
          title: "Playback error",
          description: "There was an error playing the audio. Please try again.",
          variant: "destructive",
        });
      });
      setHasPlayed(true);
      markAudioAsPlayed(); // Persist the played state
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Format time as MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-neutral-bg rounded-lg p-4">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Button 
            onClick={togglePlay} 
            variant="default" 
            size="icon" 
            className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center"
            disabled={!allowReplay && hasPlayed}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <div className="ml-3">
            <p className="font-medium">Now Playing</p>
            <p className="text-sm text-neutral-dark">
              {!allowReplay && "Remember: You can only play this audio once"}
            </p>
          </div>
        </div>
        <span className="text-neutral-dark font-medium">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      
      <div className="relative w-full">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 100}
          step={0.1}
          onValueChange={(value) => {
            if (audioRef.current) {
              audioRef.current.currentTime = value[0];
              setCurrentTime(value[0]);
            }
          }}
          disabled={!allowReplay && hasPlayed}
          className="audio-timeline w-full"
        />
        <div className="flex justify-between text-xs text-neutral-dark mt-1">
          <span>0:00</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="flex items-center mt-4">
        <Volume2 className="h-4 w-4 text-neutral-dark mr-2" />
        <Slider
          value={[volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="w-24"
        />
      </div>
    </div>
  );
}
