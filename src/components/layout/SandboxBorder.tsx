import { useSandbox } from '@/contexts/SandboxContext';

/**
 * Renders a thin amber border around the entire viewport when sandbox is active.
 * Pure visual indicator — sits above all content with pointer-events: none.
 */
export function SandboxBorder() {
  const { enabled } = useSandbox();
  if (!enabled) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] border-4 border-amber-500/70"
      aria-hidden
    />
  );
}
