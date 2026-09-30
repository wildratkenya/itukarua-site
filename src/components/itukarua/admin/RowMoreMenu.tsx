import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/**
 * The per-row "More" affordance used across /admin.
 *
 * /admin renders wide tables inside `Table`, which is wrapped in `overflow-auto`
 * (src/components/ui/table.tsx:9), so a row with four or five controls forces the
 * whole tab to scroll sideways on top of a 224px sticky sidebar. The convention
 * here is that only a row's primary action stays visible and everything else
 * lives behind this menu, so the actions cell never has to grow.
 *
 * The label is deliberately visible rather than an icon-only dot: on the
 * homepage-banner tab this pattern was already in use and the text made it
 * obvious that the row had hidden actions.
 */
export const RowMoreMenu: React.FC<{
  children: React.ReactNode;
  /** Panel width. w-60 fits the "add days" inputs; w-72 suits radio submenus. */
  width?: string;
  align?: 'start' | 'center' | 'end';
  label?: string;
  className?: string;
}> = ({ children, width = 'w-60', align = 'end', label = 'More', className = '' }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className={`h-8 gap-1 ${className}`}>
        <MoreVertical className="w-4 h-4" />
        {label}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align={align} className={width}>
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default RowMoreMenu;
