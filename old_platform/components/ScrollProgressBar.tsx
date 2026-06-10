import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isInModal, setIsInModal] = useState(false);
  const activeModalRef = useRef<Element | null>(null);

  const getModalScrollContainer = useCallback((): Element | null => {
    const selectors = [
      '[role="dialog"] [data-radix-scroll-area-viewport]',
      '[role="dialog"] .overflow-y-auto',
      '[role="dialog"] .overflow-auto',
      '[data-state="open"] [data-radix-scroll-area-viewport]',
      '[data-state="open"] .overflow-y-auto',
      '[data-vaul-drawer] .overflow-y-auto',
      '[data-vaul-drawer] .overflow-auto',
      '.fixed [data-radix-scroll-area-viewport]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.scrollHeight > el.clientHeight + 10) {
          return el;
        }
      }
    }
    return null;
  }, []);

  const calculateProgress = useCallback(() => {
    const modalContainer = getModalScrollContainer();

    if (modalContainer) {
      // Modal is open with scrollable content
      const scrollTop = modalContainer.scrollTop;
      const scrollHeight = modalContainer.scrollHeight - modalContainer.clientHeight;

      if (scrollHeight <= 0) {
        setProgress(0);
        setIsVisible(false);
      } else {
        const scrollPercent = (scrollTop / scrollHeight) * 100;
        setProgress(Math.min(100, Math.max(0, scrollPercent)));
        setIsVisible(true);
      }
      setIsInModal(true);
      activeModalRef.current = modalContainer;
    } else {
      // Page scroll
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;

      if (docHeight <= 0) {
        setProgress(0);
        setIsVisible(false);
      } else {
        const scrollPercent = (scrollTop / docHeight) * 100;
        setProgress(Math.min(100, Math.max(0, scrollPercent)));
        setIsVisible(scrollTop > 50);
      }
      setIsInModal(false);
      activeModalRef.current = null;
    }
  }, [getModalScrollContainer]);

  useEffect(() => {
    calculateProgress();

    // Window scroll listener
    window.addEventListener("scroll", calculateProgress, { passive: true });
    window.addEventListener("resize", calculateProgress, { passive: true });

    // Capture scroll events from modals
    const handleCapturedScroll = (e: Event) => {
      const target = e.target;
      if (target && typeof (target as Element).closest === 'function') {
        const el = target as Element;
        if (
          el.closest('[role="dialog"]') ||
          el.closest('[data-vaul-drawer]') ||
          el.closest('.fixed')
        ) {
          calculateProgress();
        }
      }
    };

    document.addEventListener("scroll", handleCapturedScroll, {
      passive: true,
      capture: true,
    });

    // Observe DOM changes to detect modal open/close
    const observer = new MutationObserver(() => {
      setTimeout(calculateProgress, 50);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "class"],
    });

    return () => {
      window.removeEventListener("scroll", calculateProgress);
      window.removeEventListener("resize", calculateProgress);
      document.removeEventListener("scroll", handleCapturedScroll, { capture: true });
      observer.disconnect();
    };
  }, [calculateProgress]);

  return (
    <Tooltip open={isHovered && isVisible}>
      <TooltipTrigger asChild>
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            "fixed left-0 right-0 z-[9998] h-3 bg-transparent cursor-pointer",
            "transition-opacity duration-300",
            "top-0",
            isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <div
            className={cn(
              "h-1 mt-1 bg-primary transition-all duration-100 ease-out shadow-[0_0_10px_hsl(var(--primary)/0.5)]",
              isHovered && "h-2 mt-0.5"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent 
        side="bottom" 
        className="text-xs font-medium px-2 py-1"
        style={{ marginLeft: `${Math.min(progress, 95)}%` }}
      >
        {Math.round(progress)}%
      </TooltipContent>
    </Tooltip>
  );
}
