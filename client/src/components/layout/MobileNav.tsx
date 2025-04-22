import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BookOpen, Headphones, Pen, Mic } from "lucide-react";

export default function MobileNav() {
  const [location] = useLocation();

  return (
    <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-neutral-200 shadow-lg z-20">
      <div className="flex justify-around">
        <Link href="/"
          className={cn(
            "flex flex-col items-center py-3 px-2",
            location === "/" ? "text-primary" : "text-neutral-dark"
          )}
        >
          <BookOpen className="h-6 w-6" />
          <span className="text-xs mt-1">Reading</span>
        </Link>
        <Link href="/?module=listening"
          className={cn(
            "flex flex-col items-center py-3 px-2",
            location === "/?module=listening" ? "text-primary" : "text-neutral-dark"
          )}
        >
          <Headphones className="h-6 w-6" />
          <span className="text-xs mt-1">Listening</span>
        </Link>
        <Link href="/?module=writing"
          className={cn(
            "flex flex-col items-center py-3 px-2",
            location === "/?module=writing" ? "text-primary" : "text-neutral-dark"
          )}
        >
          <Pen className="h-6 w-6" />
          <span className="text-xs mt-1">Writing</span>
        </Link>
        <Link href="/?module=speaking"
          className={cn(
            "flex flex-col items-center py-3 px-2",
            location === "/?module=speaking" ? "text-primary" : "text-neutral-dark"
          )}
        >
          <Mic className="h-6 w-6" />
          <span className="text-xs mt-1">Speaking</span>
        </Link>
      </div>
    </div>
  );
}
