'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { EquipmentAssignment } from '@/types';
import { formatDate } from '@/utils/helpers';
import {
  ASSIGNMENT_STATUS_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
} from '@/components/equipment/assignments/constants';
import {
  getAssigneeName,
  getEquipmentBrandModel,
  getInventoryCode,
} from '@/components/equipment/assignments/utils';
import { AssignmentRowActionsMenu } from '@/components/equipment/assignments/AssignmentRowActionsMenu';

type Props = {
  items: EquipmentAssignment[];
  canCreate: boolean;
  canUpdate: boolean;
  onRowClick: (assignment: EquipmentAssignment) => void;
  onReturn: (assignment: EquipmentAssignment) => void;
  onSwap: (assignment: EquipmentAssignment) => void;
  onRegenerateActa: (assignment: EquipmentAssignment, type: 'delivery' | 'return') => void;
  regenerating?: boolean;
};

export function AssignmentsMobileList(props: Props) {
  return (
    <div className="grid gap-3 md:hidden">
      {props.items.map((assignment) => (
        <Card
          key={assignment.id}
          className="cursor-pointer"
          onClick={() => props.onRowClick(assignment)}
        >
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <p className="font-medium truncate">{getAssigneeName(assignment)}</p>
              <p className="text-sm text-muted-foreground">{getEquipmentBrandModel(assignment)}</p>
              <p className="font-mono text-xs text-muted-foreground">{getInventoryCode(assignment)}</p>
              <p className="text-xs text-muted-foreground">Entregado {formatDate(assignment.assignedDate)}</p>
              <Badge variant="outline" className={ASSIGNMENT_STATUS_CLASSES[assignment.status]}>
                {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
              </Badge>
            </div>
            <AssignmentRowActionsMenu
              assignment={assignment}
              canCreate={props.canCreate}
              canUpdate={props.canUpdate}
              onViewDetail={() => props.onRowClick(assignment)}
              onReturn={() => props.onReturn(assignment)}
              onSwap={() => props.onSwap(assignment)}
              onRegenerateActa={(type) => props.onRegenerateActa(assignment, type)}
              regenerating={props.regenerating}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
