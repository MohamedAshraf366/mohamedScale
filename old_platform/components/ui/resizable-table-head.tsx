import * as React from "react";
import { cn } from "@/lib/utils";
import { TableHead } from "./table";

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  columnKey: string;
  width: number;
  minWidth?: number;
  onResize: (key: string, width: number) => void;
  children: React.ReactNode;
}

export function ResizableTableHead({
  columnKey,
  width,
  minWidth = 60,
  onResize,
  children,
  className,
  ...props
}: ResizableTableHeadProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + diff);
      onResize(columnKey, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, columnKey, minWidth, onResize]);

  return (
    <TableHead
      className={cn("relative select-none", className)}
      style={{ width: `${width}px`, minWidth: `${minWidth}px` }}
      {...props}
    >
      {children}
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
      />
    </TableHead>
  );
}
