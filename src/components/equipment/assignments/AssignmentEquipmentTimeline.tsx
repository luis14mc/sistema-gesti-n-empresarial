'use client';

import {
  ArrowLeftRight,
  CircleDot,
  Package,
  Settings,
  Trash2,
  UserPlus,
  UserMinus,
  type LucideIcon,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { AssignmentDetailResponse } from '@/services/equipment-assignments.service';
import { formatDateTime, formatRelativeDate } from '@/utils/helpers';
import { ASSIGNMENT_STATUS_LABELS } from '@/components/equipment/assignments/constants';
import { getAssigneeName } from '@/components/equipment/assignments/utils';

type TimelineEvent = {
  id: string;
  kind: 'assignment' | 'maintenance' | 'history';
  date: Date;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  isCurrent?: boolean;
};

function historyIcon(action: string): LucideIcon {
  switch (action) {
    case 'CREATED':
      return Package;
    case 'ASSIGNED':
      return UserPlus;
    case 'RETURNED':
      return UserMinus;
    case 'REPLACED':
      return ArrowLeftRight;
    case 'MAINTENANCE':
      return Settings;
    case 'RETIRED':
      return Trash2;
    default:
      return CircleDot;
  }
}

function assignmentIcon(status: string): LucideIcon {
  if (status === 'RETURNED') return UserMinus;
  if (status === 'REPLACED') return ArrowLeftRight;
  return UserPlus;
}

function buildEvents(
  timeline: AssignmentDetailResponse['equipmentTimeline'],
  currentAssignmentId: string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const row of timeline.assignments) {
    const assigned = new Date(row.assignedDate);
    events.push({
      id: `assign-${row.id}`,
      kind: 'assignment',
      date: assigned,
      title: `Asignado a ${getAssigneeName(row)}`,
      subtitle: ASSIGNMENT_STATUS_LABELS[row.status] ?? row.status,
      icon: assignmentIcon(row.status),
      isCurrent: row.id === currentAssignmentId,
    });
    if (row.returnedDate) {
      events.push({
        id: `return-${row.id}`,
        kind: 'assignment',
        date: new Date(row.returnedDate),
        title: `Devuelto por ${getAssigneeName(row)}`,
        subtitle: row.returnReason ?? undefined,
        icon: UserMinus,
        isCurrent: row.id === currentAssignmentId,
      });
    }
  }

  for (const m of timeline.maintenances) {
    const date = m.completedDate ?? m.scheduledDate;
    if (!date) continue;
    events.push({
      id: `maint-${m.id}`,
      kind: 'maintenance',
      date: new Date(date),
      title: 'Mantenimiento',
      subtitle: m.description,
      icon: Settings,
    });
  }

  for (const h of timeline.history) {
    events.push({
      id: `hist-${h.id}`,
      kind: 'history',
      date: new Date(h.createdAt),
      title: h.title,
      subtitle: h.description ?? undefined,
      icon: historyIcon(h.action),
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function AssignmentEquipmentTimeline({
  timeline,
  currentAssignmentId,
}: {
  timeline: AssignmentDetailResponse['equipmentTimeline'];
  currentAssignmentId: string;
}) {
  const events = buildEvents(timeline, currentAssignmentId);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <ol className="relative space-y-0 border-l border-border pl-6" data-testid="assignment-equipment-timeline">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <li key={event.id} className="relative pb-6 last:pb-0">
              <span
                className={`absolute -left-[calc(0.75rem+1px)] flex size-6 items-center justify-center rounded-full border bg-background ${
                  event.isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                }`}
              >
                <Icon className={`size-3.5 ${event.isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
              </span>
              <div
                className={`min-w-0 break-words rounded-lg border p-3 ${
                  event.isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border'
                }`}
              >
                <p className="text-sm font-medium">{event.title}</p>
                {event.subtitle ? (
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">{event.subtitle}</p>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelativeDate(event.date)}</p>
                  </TooltipTrigger>
                  <TooltipContent>{formatDateTime(event.date)}</TooltipContent>
                </Tooltip>
              </div>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}
