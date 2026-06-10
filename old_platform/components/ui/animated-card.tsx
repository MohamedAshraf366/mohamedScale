import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card";

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  index?: number;
  animation?: "card-enter" | "float-in" | "slide-up";
}

const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, index = 0, animation = "card-enter", ...props }, ref) => {
    const staggerClass = index <= 8 ? `stagger-${index}` : "";
    const animationClass = `animate-${animation}`;
    
    return (
      <Card
        ref={ref}
        className={cn(animationClass, staggerClass, className)}
        {...props}
      />
    );
  }
);
AnimatedCard.displayName = "AnimatedCard";

export { AnimatedCard };
