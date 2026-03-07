/**
 * CloudBlocks Design System
 * — All components exported from a single entry point.
 *
 * Usage in any page/component:
 *   import { Button, Badge, Card, Input } from "@/components/ui"
 *   import { Sidebar, Topbar } from "@/components/layout"
 */

// ── Primitives ──────────────────────────────────────────────
export { Button }                         from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Badge }                          from "./Badge";
export type { BadgeProps, BadgeVariant }  from "./Badge";

export { Input, Textarea, Select, FormField } from "./Input";
export type { InputProps, TextareaProps, SelectProps, FormFieldProps } from "./Input";

export { Alert }                          from "./Alert";
export type { AlertProps, AlertVariant }  from "./Alert";

// ── Composites ──────────────────────────────────────────────
export { Card, CardHeader, CardBody, CardFooter, StatCard } from "./Card";
export type { CardProps, CardHeaderProps, StatCardProps }   from "./Card";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
export type { TabsProps, TabsTriggerProps, TabsContentProps } from "./Tabs";

export {
  TableWrapper, Table, TableHead, TableBody,
  TableRow, TableHeader, TableCell, TableCaption,
} from "./Table";

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "./Dropdown";

export { Modal, ModalBody, ModalFooter } from "./Modal";
export type { ModalProps }               from "./Modal";

// ── Utilities ───────────────────────────────────────────────
export {
  Progress, Avatar, Divider, Skeleton,
  Tooltip, Kbd, CodeBlock,
} from "./Misc";
export type {
  ProgressProps, AvatarProps, DividerProps,
  SkeletonProps, TooltipProps, CodeBlockProps,
} from "./Misc";

// ── Notifications ───────────────────────────────────────────
export { ToastProvider, useToast } from "./Toast";