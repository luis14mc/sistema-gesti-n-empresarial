import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Equipment, User, EquipmentAssignment } from '@/types';

interface AssignmentNoteProps {
    equipment: Equipment;
    assignment: EquipmentAssignment;
    user: User;
}

export const AssignmentNoteContent = ({ equipment, assignment, user }: AssignmentNoteProps) => {
    return (
        <div className="p-8 max-w-[800px] mx-auto bg-white text-black font-sans print:p-0 print:max-w-full">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-[#252A58] pb-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[#252A58] uppercase tracking-wider font-heading">
                        Acta de Entrega de Equipo
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Institución de Gestión Empresarial</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-[#252A58]">{equipment.code}</p>
                    <p className="text-sm text-gray-500">
                        {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}
                    </p>
                </div>
            </div>

            {/* Intro */}
            <p className="mb-6 leading-relaxed">
                Por medio de la presente, se hace constar la entrega del equipo detallado a continuación al colaborador
                <span className="font-bold"> {user.firstName} {user.lastName}</span>, quien acepta la responsabilidad de su custodia,
                buen uso y mantenimiento básico según las políticas institucionales.
            </p>

            {/* Equipment Details */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8">
                <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
                    Detalles del Activo
                </h2>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <p className="text-gray-500">Equipo:</p>
                    <p className="font-medium">{equipment.name}</p>

                    <p className="text-gray-500">Tipo:</p>
                    <p className="font-medium">{equipment.type}</p>

                    <p className="text-gray-500">Marca/Modelo:</p>
                    <p className="font-medium">{equipment.brand} {equipment.model}</p>

                    <p className="text-gray-500">Serie:</p>
                    <p className="font-medium font-mono">{equipment.serialNumber || 'N/A'}</p>

                    <p className="text-gray-500">Estado de Entrega:</p>
                    <p className="font-medium">{assignment.condition || 'Óptimo'}</p>
                </div>
            </div>

            {/* Conditions */}
            <div className="mb-8">
                <h2 className="text-sm font-bold text-[#252A58] uppercase mb-3 border-b border-gray-300 pb-1">
                    Compromisos del Usuario
                </h2>
                <ul className="list-disc ml-5 text-sm space-y-2 leading-tight text-gray-700">
                    <li>El equipo es propiedad exclusiva de la institución y debe ser devuelto al finalizar el vínculo laboral o por requerimiento de IT.</li>
                    <li>Queda prohibida la instalación de software no autorizado o la manipulación física del hardware.</li>
                    <li>Cualquier daño, robo o extravío debe ser reportado inmediatamente a Soporte IT y Seguridad.</li>
                    <li>El usuario es responsable de la integridad de la información almacenada en el dispositivo.</li>
                </ul>
            </div>

            {/* Signatures */}
            <div className="mt-20 grid grid-cols-2 gap-20">
                <div className="text-center">
                    <div className="border-t border-black pt-2 mb-1"></div>
                    <p className="font-bold text-sm uppercase">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500">Recibe Conforme (Usuario)</p>
                    <p className="text-xs text-gray-400 mt-1">DNI: ____________________</p>
                </div>
                <div className="text-center">
                    <div className="border-t border-black pt-2 mb-1"></div>
                    <p className="font-bold text-sm uppercase">Soporte Técnico / TI</p>
                    <p className="text-xs text-gray-500">Entrega (Institucional)</p>
                    <p className="text-xs text-gray-400 mt-1">Firma y Sello</p>
                </div>
            </div>

            {/* Footer / Observation */}
            <div className="mt-16 text-[10px] text-gray-400 italic text-center border-t pt-2">
                Documento generado automáticamente por el Sistema de Gestión Empresarial (SGE).
                Este documento impreso es una copia fiel del registro digital en la base de datos institucional.
            </div>
        </div>
    );
};
