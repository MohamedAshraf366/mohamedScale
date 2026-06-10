import { useState, useEffect, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 300;

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  const getScrollableContainer = useCallback((): Element | Window => {
    // Check for open modals/dialogs with scroll areas
    const modalScrollAreas = document.querySelectorAll(
      '[role="dialog"] [data-radix-scroll-area-viewport], ' +
      '[role="dialog"] .overflow-y-auto, ' +
      '[role="dialog"] .overflow-auto, ' +
      '[data-state="open"] [data-radix-scroll-area-viewport], ' +
      '[data-state="open"] .overflow-y-auto, ' +
      '.fixed .overflow-y-auto, ' +
      '.fixed .overflow-auto'
    );

    for (const el of modalScrollAreas) {
      if (el.scrollTop > 0 || el.scrollHeight > el.clientHeight) {
        return el;
      }
    }

    // Check for sheet/drawer scroll areas
    const sheetScrollAreas = document.querySelectorAll(
      '[data-vaul-drawer] .overflow-y-auto, ' +
      '[data-vaul-drawer] .overflow-auto'
    );

    for (const el of sheetScrollAreas) {
      if (el.scrollTop > 0 || el.scrollHeight > el.clientHeight) {
        return el;
      }
    }

    return window;
  }, []);

  const checkScrollPosition = useCallback(() => {
    const container = getScrollableContainer();
    
    if (container === window) {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD);
    } else {
      setIsVisible((container as Element).scrollTop > SCROLL_THRESHOLD);
    }
  }, [getScrollableContainer]);

  useEffect(() => {
    // Initial check
    checkScrollPosition();

    // Listen to scroll on window
    window.addEventListener("scroll", checkScrollPosition, { passive: true });

    // Also observe DOM changes to detect modal openings
    const observer = new MutationObserver(() => {
      setTimeout(checkScrollPosition, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "class"],
    });

    // Listen to scroll on any modal that opens
    const handleModalScroll = (e: Event) => {
      const target = e.target;
      if (target && typeof (target as Element).closest === 'function') {
        const el = target as Element;
        if (
          el.closest('[role="dialog"]') ||
          el.closest('[data-vaul-drawer]') ||
          el.closest('.fixed')
        ) {
          checkScrollPosition();
        }
      }
    };

    document.addEventListener("scroll", handleModalScroll, { 
      passive: true, 
      capture: true 
    });

    return () => {
      window.removeEventListener("scroll", checkScrollPosition);
      document.removeEventListener("scroll", handleModalScroll, { capture: true });
      observer.disconnect();
    };
  }, [checkScrollPosition]);

  const scrollToTop = () => {
    const container = getScrollableContainer();

    if (container === window) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      (container as Element).scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={scrollToTop}
          aria-label="Back to top"
          className={cn(
            "fixed z-[9999] flex h-11 w-11 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            "transition-all duration-300 ease-out",
            "hover:scale-110 hover:shadow-xl hover:brightness-110",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2",
            // Position: bottom-right with safe padding for toasts/chat
            "bottom-20 right-4 sm:bottom-6 sm:right-6",
            // Fade in/out
            isVisible
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="font-medium">
        Back to top
      </TooltipContent>
    </Tooltip>
  );
}
