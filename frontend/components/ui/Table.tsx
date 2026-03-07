import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   TABLE
   Usage:
     <Table>
       <TableHead>
         <TableRow>
           <TableHeader>Name</TableHeader>
           <TableHeader>Status</TableHeader>
         </TableRow>
       </TableHead>
       <TableBody>
         <TableRow>
           <TableCell>my-api</TableCell>
           <TableCell><Badge variant="success">Running</Badge></TableCell>
         </TableRow>
       </TableBody>
     </Table>
   ============================================================ */

function TableWrapper({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-lg border border-cb",
        className
      )}
    >
      {children}
    </div>
  );
}

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-cb-elevated border-b border-cb", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-cb-border", className)} {...props} />;
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors duration-100",
        "hover:bg-cb-hover",
        className
      )}
      {...props}
    />
  );
}

function TableHeader({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left",
        "text-2xs font-semibold text-cb-muted uppercase tracking-wider",
        "whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, mono, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-cb-primary align-middle",
        mono && "font-mono text-xs",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn("py-3 text-xs text-cb-muted text-center", className)}
      {...props}
    />
  );
}

export {
  TableWrapper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableCaption,
};