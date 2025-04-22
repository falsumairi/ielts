import { useState, useEffect } from "react";
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Undo, 
  Redo 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface TextEditorProps {
  initialContent?: string;
  placeholder?: string;
  minWords?: number;
  onChange: (content: string) => void;
  onWordCountChange?: (count: number) => void;
}

export default function TextEditor({
  initialContent = "",
  placeholder = "Write your response here...",
  minWords = 250,
  onChange,
  onWordCountChange
}: TextEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [wordCount, setWordCount] = useState(0);
  const [history, setHistory] = useState<string[]>([initialContent]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    // Count words in content
    const words = content.trim().split(/\s+/);
    const count = content.trim() ? words.length : 0;
    setWordCount(count);
    
    if (onWordCountChange) {
      onWordCountChange(count);
    }
  }, [content, onWordCountChange]);

  // Auto-save effect
  useEffect(() => {
    let saveTimeout: NodeJS.Timeout;
    
    if (content !== history[historyIndex]) {
      setAutoSaving(true);
      
      // Add to history when user stops typing
      saveTimeout = setTimeout(() => {
        onChange(content);
        setAutoSaving(false);
        
        // Only add to history if content changed
        if (content !== history[historyIndex]) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(content);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
        }
      }, 1000);
    }
    
    return () => {
      clearTimeout(saveTimeout);
    };
  }, [content, history, historyIndex, onChange]);

  // Apply formatting to text
  const applyFormatting = (format: string) => {
    // This is a simplified implementation
    // In a real application, you would need to handle text selection,
    // cursor position, etc.
    
    let newContent = content;
    
    // Example implementations (simplified)
    switch (format) {
      case 'bold':
        newContent += '**bold text**';
        break;
      case 'italic':
        newContent += '_italic text_';
        break;
      case 'underline':
        newContent += '__underlined text__';
        break;
      case 'list':
        newContent += '\n- List item\n- List item\n- List item';
        break;
      case 'ordered-list':
        newContent += '\n1. List item\n2. List item\n3. List item';
        break;
      default:
        break;
    }
    
    setContent(newContent);
  };

  // Undo/Redo functionality
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setContent(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setContent(history[historyIndex + 1]);
    }
  };

  const clear = () => {
    if (confirm("Are you sure you want to clear all content?")) {
      setContent("");
      const newHistory = [...history, ""];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      onChange("");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Your Response</h2>
        <div className="text-sm text-neutral-dark">
          <span className={`font-medium ${wordCount < minWords ? 'text-amber-500' : 'text-green-500'}`}>
            {wordCount}
          </span> words {minWords > 0 && `(minimum ${minWords})`}
        </div>
      </div>
      
      {/* Editor Toolbar */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3 mb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-2 rounded hover:bg-neutral-bg transition" 
          title="Bold"
          onClick={() => applyFormatting('bold')}
        >
          <Bold className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-2 rounded hover:bg-neutral-bg transition" 
          title="Italic"
          onClick={() => applyFormatting('italic')}
        >
          <Italic className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-2 rounded hover:bg-neutral-bg transition" 
          title="Underline"
          onClick={() => applyFormatting('underline')}
        >
          <Underline className="h-5 w-5" />
        </Button>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-2 rounded hover:bg-neutral-bg transition" 
          title="Bulleted List"
          onClick={() => applyFormatting('list')}
        >
          <List className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-2 rounded hover:bg-neutral-bg transition" 
          title="Numbered List"
          onClick={() => applyFormatting('ordered-list')}
        >
          <ListOrdered className="h-5 w-5" />
        </Button>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-2 rounded hover:bg-neutral-bg transition" 
          title="Undo"
          onClick={undo}
          disabled={historyIndex <= 0}
        >
          <Undo className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-2 rounded hover:bg-neutral-bg transition" 
          title="Redo"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
        >
          <Redo className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Text Editor */}
      <Textarea 
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full h-80 p-4 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
      />
      
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-neutral-dark italic">
          {autoSaving ? 'Auto-saving...' : 'All changes saved'}
        </div>
        <div>
          <Button 
            variant="outline" 
            className="mr-2" 
            onClick={clear}
          >
            Clear All
          </Button>
          <Button 
            variant="default" 
            className="bg-primary text-white"
            onClick={() => onChange(content)}
          >
            Save Draft
          </Button>
        </div>
      </div>
    </div>
  );
}
