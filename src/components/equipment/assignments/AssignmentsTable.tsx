'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { EquipmentAssignment } from '@/types';
import { formatDate, formatRelativeDate } from '@/utils/helpers';
import {
  ASSIGNMENT_STATUS_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
} from '@/components/equipment/assignments/constants';
import {
  equipmentCategoryIcon,
  equipmentTypeLabel,
  getAssigneeName,
  getDepartmentLine,
  getEquipmentBrandModel,
  getInventoryCode,
  getSerialNumber,
} from '@/components/equipment/assignments/utils';
import { AssignmentRowActionsMenu } from '@/components/equipment/assignments/AssignmentRowActionsMenu';
import type { AssignmentFilters } from '@/types';

type SortKey = NonNullable<AssignmentFilters['sortBy']>;

type Props = {
  items: EquipmentAssignment[];
  showReturnedColumn: boolean;
  sortBy: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (column: SortKey) => void;
  onRowClick: (assignment: EquipmentAssignment) => void;
  canCreate: boolean;
  canUpdate: boolean;
  onReturn: (assignment: EquipmentAssignment) => void;
  onSwap: (assignment: EquipmentAssignment) => void;
  onRegenerateActa: (assignment: EquipmentAssignment, type: 'delivery' | 'return') => void;
  regenerating?: boolean;
};

function SortButton({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortBy: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (column: SortKey) => void;
}) {
  const active = sortBy === column;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 font-medium"
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : null}
    </Button>
  );
}

export function AssignmentsTable({
  items,
  showReturnedColumn,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  canCreate,
  canUpdate,
  onReturn,
  onSwap,
  onRegenerateActa,
  regenerating,
}: Props) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border md:block" data-testid="assignments-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton label="Empleado" column="employee" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>Equipo</TableHead>
            <TableHead className="hidden md:table-cell">N° serie</TableHead>
            <TableHead>
              <SortButton label="Entregado" column="assignedDate" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            {showReturnedColumn ? (
              <TableHead>
                <SortButton label="Devuelto" column="returnedDate" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </TableHead>
            ) : null}
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((assignment) => {
            const Icon = equipmentCategoryIcon(assignment.equipment?.category);
            return (
              <TableRow
                key={assignment.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(assignment)}
              >
                <TableCell>
                  <p className="font-medium">{getAssigneeName(assignment)}</p>
                  <p className="text-xs text-muted-foreground">{getDepartmentLine(assignment)}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-sm">
                        {equipmentTypeLabel(assignment)} · {getEquipmentBrandModel(assignment)}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{getInventoryCode(assignment)}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">{getSerialNumber(assignment)}</TableCell>
                <TableCell className="text-sm">
                  <p>{formatDate(assignment.assignedDate)}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeDate(assignment.assignedDate)}</p>
                </TableCell>
                {showReturnedColumn ? (
                  <TableCell className="text-sm">
                    {assignment.returnedDate ? (
                      <>
                        <p>{formatDate(assignment.returnedDate)}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeDate(assignment.returnedDate)}</p>
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                ) : null}
                <TableCell>
                  <Badge variant="outline" className={ASSIGNMENT_STATUS_CLASSES[assignment.status]}>
                    {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <AssignmentRowActionsMenu
                    assignment={assignment}
                    canCreate={canCreate}
                    canUpdate={canUpdate}
                    onViewDetail={() => onRowClick(assignment)}
                    onReturn={() => onReturn(assignment)}
                    onSwap={() => onSwap(assignment)}
                    onRegenerateActa={(type) => onRegenerateActa(assignment, type)}
                    regenerating={regenerating}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Columnas visibles en desktop: Empleado, Equipo, Serie, Entregado, [Devuelto], Estado, Acciones */
export const ASSIGNMENTS_TABLE_COLUMN_COUNT = 7;
