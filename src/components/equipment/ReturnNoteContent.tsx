import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Equipment, EquipmentAssignment } from '@/types';

interface ReturnNoteProps {
  equipment: Equipment;
  assignment: EquipmentAssignment;
}

function getAssigneeName(assignment: EquipmentAssignment) {
  return (
    assignment.employeeNameAtTime ||
    assignment.assigneeName ||
    assignment.employee?.fullName ||
    (assignment.user ? `${assignment.user.firstName} ${assignment.user.lastName}` : '—')
  );
}

export const ReturnNoteContent = ({ equipment, assignment }: ReturnNoteProps) => {
  const assigneeName = getAssigneeName(assignment);
  const returnDate = assignment.returnedDate
    ? format(new Date(assignment.returnedDate), "dd 'de' MMMM, yyyy", { locale: es })
    : format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });

  return (
    <div className="p-8 max-w-[800px] mx-auto bg-white text-black font-sans print:p-0 print:max-w-full">
      <div className="flex justify-between items-start border-b-2 border-[#252A58] pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#252A58] uppercase tracking-wider font-heading">
            Acta / Formato de Devolución de Equipo
          </h1>
          <p className="text-sm text-gray-600 mt-1">Sistema de Gestión Empresarial — TI</p>
        </div>
        <div className="text-right text-sm">
          <p><span className="text-gray-500">No. asignación:</span> <strong>{assignment.id.slice(-8).toUpperCase()}</strong></p>
          <p><span className="text-gray-500">Fecha devolución:</span> {returnDate}</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 text-sm">
        <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
          Colaborador
        </h2>
        <div className="grid grid-cols-2 gap-y-2">
          <p className="text-gray-500">Empleado:</p>
          <p className="font-medium">{assigneeName}</p>
          <p className="text-gray-500">Departamento (al momento de entrega):</p>
          <p className="font-medium">{assignment.departmentAtTime || '—'}</p>
          <p className="text-gray-500">Puesto:</p>
          <p className="font-medium">{assignment.positionAtTime || '—'}</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 text-sm">
        <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
          Equipo devuelto
        </h2>
        <div className="grid grid-cols-2 gap-y-2">
          <p className="text-gray-500">Código:</p>
          <p className="font-medium font-mono">{equipment.code || equipment.inventoryCode}</p>
          <p className="text-gray-500">Tipo:</p>
          <p className="font-medium">{equipment.categoryLabel || equipment.type}</p>
          <p className="text-gray-500">Marca / Modelo:</p>
          <p className="font-medium">{equipment.brand} {equipment.model}</p>
          <p className="text-gray-500">Serie:</p>
          <p className="font-medium font-mono">{equipment.serialNumber || 'N/A'}</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8 text-sm">
        <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
          Detalle de devolución
        </h2>
        <div className="grid grid-cols-2 gap-y-2">
          <p className="text-gray-500">Motivo:</p>
          <p className="font-medium">{assignment.returnReason || '—'}</p>
          <p className="text-gray-500">Estado físico:</p>
          <p className="font-medium">{assignment.returnCondition || '—'}</p>
          {(assignment.returnNotes || assignment.notes) && (
            <>
              <p className="text-gray-500">Observaciones:</p>
              <p className="font-medium whitespace-pre-wrap">{assignment.returnNotes || assignment.notes}</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-20 text-sm">
        <div className="text-center">
          <div className="border-t border-black pt-2 mb-1" />
          <p className="font-bold uppercase">{assigneeName}</p>
          <p className="text-xs text-gray-500">Devuelve conforme</p>
        </div>
        <div className="text-center">
          <div className="border-t border-black pt-2 mb-1" />
          <p className="font-bold uppercase">Soporte TI</p>
          <p className="text-xs text-gray-500">Recibe conforme</p>
        </div>
      </div>

      <div className="mt-12 text-[10px] text-gray-400 italic text-center border-t pt-2">
        Documento generado por SGE. Registro digital: {assignment.id}
      </div>
    </div>
  );
};
