import { useEffect, useState } from "react";
import scaleLogo from "@/assets/scale-logo-orange.svg";

interface LoadingScreenProps {
  minDuration?: number;
  onLoadingComplete?: () => void;
}

const LoadingScreen = ({ minDuration = 1800, onLoadingComplete }: LoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsVisible(false);
        onLoadingComplete?.();
      }, 400);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onLoadingComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-sidebar transition-opacity duration-400 ${
        isFadingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Logo container */}
      <div className="flex flex-col items-center">
        <div className="animate-logo-entrance">
          <img
            src={scaleLogo}
            alt="Scale Logo"
            className="h-16 md:h-20 w-auto"
          />
        </div>

        {/* Loading bar */}
        <div className="mt-10 w-48 h-1 bg-sidebar-accent/40 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-loading-bar" />
        </div>

        {/* Loading text */}
        <p className="mt-5 text-sidebar-foreground/60 text-sm font-light tracking-wide">
          Loading...
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
