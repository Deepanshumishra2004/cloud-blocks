"use client";
import { Separator } from "react-resizable-panels";

export function ResizeHandleH() {
  return (
    <Separator className="group relative w-1 bg-transparent hover:bg-white/10 transition-colors data-resize-handle-active:bg-white/20">
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/8 group-hover:bg-white/20 group-data-resize-handle-active:bg-white/30 transition-colors" />
    </Separator>
  );
}

export function ResizeHandleV() {
  return (
    <Separator className="group relative h-1 bg-transparent hover:bg-white/10 transition-colors data-resize-handle-active:bg-white/20">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/8 group-hover:bg-white/20 group-data-resize-handle-active:bg-white/30 transition-colors" />
    </Separator>
  );
}
