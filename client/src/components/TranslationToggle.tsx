import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Loader2, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TranslationToggleProps {
  text: string;
  isArabic?: boolean;
  onTranslated: (translatedText: string) => void;
  className?: string;
  variant?: "default" | "outline" | "subtle";
  compact?: boolean;
}

export default function TranslationToggle({
  text,
  isArabic = false,
  onTranslated,
  className = "",
  variant = "outline",
  compact = false
}: TranslationToggleProps) {
  const [isTranslated, setIsTranslated] = useState(false);
  const { toast } = useToast();

  // Translation mutation
  const translateMutation = useMutation({
    mutationFn: async (text: string) => {
      // Determine if we are translating from English to Arabic or vice versa
      const endpoint = isArabic ? "/api/translate/to-english" : "/api/translate/to-arabic";
      const response = await apiRequest("POST", endpoint, { text });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Translation failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      onTranslated(data.translation);
      setIsTranslated(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Translation failed",
        description: error.message || "Could not translate the text",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (pressed: boolean) => {
    if (pressed === isTranslated) return;
    
    if (!text.trim()) {
      toast({
        title: "Nothing to translate",
        description: "There is no text available to translate",
        variant: "destructive",
      });
      return;
    }
    
    if (pressed) {
      // Translate the text
      translateMutation.mutate(text);
    } else {
      // Revert to original text
      onTranslated(text);
      setIsTranslated(false);
    }
  };
  
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`px-2 h-8 ${className}`}
        onClick={() => handleToggle(!isTranslated)}
        disabled={translateMutation.isPending}
      >
        {translateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Languages className="h-4 w-4 mr-1" />
            {isTranslated ? "Show Original" : isArabic ? "Show in English" : "عرض بالعربية"}
          </>
        )}
      </Button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Toggle
        variant={variant}
        aria-label="Toggle translation"
        pressed={isTranslated}
        onPressedChange={handleToggle}
        disabled={translateMutation.isPending}
        className="flex items-center gap-1.5"
      >
        {translateMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Languages className="h-3.5 w-3.5" />
        )}
        {isTranslated ? "Show Original" : isArabic ? "Show in English" : "عرض بالعربية"}
      </Toggle>
    </div>
  );
}