import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Equipment, EquipmentAssignment } from '@/types';

interface AssignmentNoteProps {
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

function getAssigneeEmail(assignment: EquipmentAssignment) {
  return (
    assignment.employeeEmailAtTime ||
    assignment.assigneeEmail ||
    assignment.employee?.email ||
    assignment.user?.email ||
    '—'
  );
}

export const AssignmentNoteContent = ({ equipment, assignment }: AssignmentNoteProps) => {
  const assigneeName = getAssigneeName(assignment);
  const assigneeEmail = getAssigneeEmail(assignment);
  const assignmentNo = assignment.id.slice(-8).toUpperCase();
  const assignedDate = assignment.assignedDate
    ? format(new Date(assignment.assignedDate), "dd 'de' MMMM, yyyy", { locale: es })
    : format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });

  return (
    <div className="p-8 max-w-[800px] mx-auto bg-white text-black font-sans print:p-0 print:max-w-full">
      <div className="flex justify-between items-start border-b-2 border-[#252A58] pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#252A58] uppercase tracking-wider font-heading">
            Acta / Formato de Asignación de Equipo
          </h1>
          <p className="text-sm text-gray-600 mt-1">Sistema de Gestión Empresarial — TI</p>
        </div>
        <div className="text-right text-sm">
          <p><span className="text-gray-500">No. asignación:</span> <strong>{assignmentNo}</strong></p>
          <p><span className="text-gray-500">Fecha:</span> {assignedDate}</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 text-sm">
        <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
          Datos del colaborador
        </h2>
        <div className="grid grid-cols-2 gap-y-2">
          <p className="text-gray-500">Empleado:</p>
          <p className="font-medium">{assigneeName}</p>
          <p className="text-gray-500">Correo institucional:</p>
          <p className="font-medium">{assigneeEmail}</p>
          <p className="text-gray-500">Departamento / Área:</p>
          <p className="font-medium">{assignment.departmentAtTime || '—'}</p>
          <p className="text-gray-500">Puesto de trabajo:</p>
          <p className="font-medium">{assignment.positionAtTime || '—'}</p>
          {assignment.deliveryReason && (
            <>
              <p className="text-gray-500">Motivo de entrega:</p>
              <p className="font-medium">{assignment.deliveryReason}</p>
            </>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8 text-sm">
        <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
          Datos del equipo
        </h2>
        <div className="grid grid-cols-2 gap-y-2">
          <p className="text-gray-500">Código interno:</p>
          <p className="font-medium font-mono">{equipment.code || equipment.inventoryCode}</p>
          <p className="text-gray-500">Tipo de equipo:</p>
          <p className="font-medium">{equipment.categoryLabel || equipment.type}</p>
          <p className="text-gray-500">Marca:</p>
          <p className="font-medium">{equipment.brand}</p>
          <p className="text-gray-500">Modelo:</p>
          <p className="font-medium">{equipment.model}</p>
          <p className="text-gray-500">Serie:</p>
          <p className="font-medium font-mono">{equipment.serialNumber || 'N/A'}</p>
          {equipment.processor && (<><p className="text-gray-500">Procesador:</p><p className="font-medium">{equipment.processor}</p></>)}
          {equipment.ram && (<><p className="text-gray-500">RAM:</p><p className="font-medium">{equipment.ram}</p></>)}
          {equipment.storage && (<><p className="text-gray-500">Almacenamiento:</p><p className="font-medium">{equipment.storage}</p></>)}
          {equipment.os && (<><p className="text-gray-500">Sistema operativo:</p><p className="font-medium">{equipment.os}</p></>)}
          {assignment.assignmentNotes && (
            <>
              <p className="text-gray-500">Accesorios / notas:</p>
              <p className="font-medium whitespace-pre-wrap">{assignment.assignmentNotes || assignment.notes}</p>
            </>
          )}
        </div>
      </div>

      <div className="mb-8 text-sm">
        <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
          Condiciones
        </h2>
        <ul className="list-disc ml-5 space-y-2 leading-relaxed text-gray-700">
          <li>El equipo se entrega para uso institucional exclusivamente.</li>
          <li>El empleado se compromete al buen uso y custodia del activo.</li>
          <li>Cualquier daño, pérdida o incidente debe ser reportado a TI de inmediato.</li>
          <li>El equipo debe ser devuelto al finalizar el vínculo laboral o por requerimiento de TI.</li>
        </ul>
      </div>

      <div className="mt-16 grid grid-cols-3 gap-12 text-sm">
        <div className="text-center">
          <div className="border-t border-black pt-2 mb-1" />
          <p className="font-bold uppercase">{assigneeName}</p>
          <p className="text-xs text-gray-500">Recibido por</p>
        </div>
        <div className="text-center">
          <div className="border-t border-black pt-2 mb-1" />
          <p className="font-bold uppercase">Soporte TI</p>
          <p className="text-xs text-gray-500">Entregado por</p>
        </div>
        <div className="text-center">
          <div className="border-t border-black pt-2 mb-1" />
          <p className="font-bold uppercase">Jefe inmediato</p>
          <p className="text-xs text-gray-500">Vo. Bo. (si aplica)</p>
        </div>
      </div>

      <div className="mt-12 text-[10px] text-gray-400 italic text-center border-t pt-2">
        Documento generado por SGE. Registro digital: {assignment.id}
      </div>
    </div>
  );
};
