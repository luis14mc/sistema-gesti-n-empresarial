/** Textos fijos de actas CNI — editar aquí sin tocar plantillas HTML. */

export const ACTA_HEADER_ORG_TITLE = 'CONSEJO NACIONAL DE INVERSIONES (CNI)';
export const ACTA_HEADER_CONFIDENTIAL = 'USO INTERNO — CONFIDENCIAL';

export const ACTA_FOOTER_ADDRESS =
  'Centro Cívico Gubernamental, Blvd. Juan Pablo II, / Diag. República de Corea, Tegucigalpa';
export const ACTA_FOOTER_PHONE_WEB = 'Tel. +504 2242-8955 / www.cni.hn';

export const ACTA_CONFIDENTIALITY_NOTE =
  'Nota de confidencialidad: Este documento contiene información interna del CNI sobre activos y licencias. Queda terminantemente prohibida su difusión externa sin autorización expresa de la Dirección correspondiente.';

export const ACTA_DEFAULT_DELIVERER_DEPARTMENT = 'Dirección Administrativa';

/** Acta 1 — Asignación */
export const ACTA_ASSIGNMENT_SUBJECT = 'Asignación de equipo de cómputo';
export const ACTA_ASSIGNMENT_INTRO_BOLD =
  'Por medio del presente se informa que, con fecha indicada arriba, se procede a la entrega y asignación del siguiente equipo de cómputo para uso institucional del CNI.';
export const ACTA_ASSIGNMENT_INTRO_REST =
  ' El equipo permanecerá bajo la custodia y responsabilidad del funcionario receptor y su uso deberá regirse por las políticas internas de seguridad y uso de recursos informáticos del CNI.';

export const ACTA_SECTION_EQUIPMENT_DETAILS = 'Detalles del equipo';

export const ACTA_ASSIGNMENT_CONDITIONS_TITLE = 'Condiciones de Entrega';

export function actaAssignmentCondition1(equipmentState: 'nuevo' | 'en buen estado'): string {
  return `El equipo se entrega ${equipmentState} y con el software institucional necesario para el desempeño de las funciones.`;
}

export function actaAssignmentConditions(equipmentState: 'nuevo' | 'en buen estado'): readonly string[] {
  return [
    actaAssignmentCondition1(equipmentState),
    'El receptor se compromete a utilizar el equipo exclusivamente para actividades relacionadas con sus funciones en el CNI.',
    'No instalar software no autorizado ni transferir licencias sin autorización previa por escrito.',
    'Reportar de inmediato cualquier daño, pérdida o robo a la Dirección Administrativa.',
    'En caso de terminación de la relación laboral o traslado de funciones, el equipo deberá devolverse en las mismas condiciones en que fue entregado, incluyendo el respaldo (backup) total de la información contenida en la máquina, salvo el desgaste razonable por uso normal.',
  ];
}

export const ACTA_ASSIGNMENT_ACCEPTANCE =
  'Declaro haber recibido el equipo descrito en este memorándum, así como haber sido informado de las obligaciones y condiciones de uso establecidas por el CNI.';

/** Acta 2 — Devolución */
export const ACTA_RETURN_SUBJECT = 'Acta descargo y devolución de equipo cómputo';

export const ACTA_RETURN_INTRO_1 =
  'Por medio de la presente se hace constar que el funcionario(a) {empleado} adscrito(a) a la {departamento} realiza la devolución formal del equipo de cómputo que tenía asignado para el desempeño de sus funciones institucionales.';

export const ACTA_RETURN_PARAGRAPH_SUBSTITUTION =
  'La devolución se efectúa como parte del proceso de sustitución y reasignación de equipo informático, quedando el activo bajo custodia de la Dirección Administrativa para su correspondiente revisión técnica, actualización de inventario y determinación de su disposición final.';

export const ACTA_RETURN_PARAGRAPH_OTHER =
  'La devolución se efectúa por motivo de {motivo}, quedando el activo bajo custodia de la Dirección Administrativa para su correspondiente revisión técnica, actualización de inventario y determinación de su disposición final.';

export const ACTA_RETURN_VERIFICATION_TITLE = 'Verificación al momento de la devolución';
export const ACTA_RETURN_VERIFICATION_INTRO = 'Se deja constancia de que, al momento de recibir el equipo:';

export const ACTA_RETURN_VERIFICATION_BULLETS = [
  'Se verificó físicamente el activo y los accesorios entregados.',
  'Se realizó o coordinó el respaldo de la información institucional contenida en el equipo, cuando correspondía.',
  'Se verificó la existencia de documentación o archivos institucionales que deban ser trasladados al nuevo equipo.',
  'Se procederá con la revisión técnica correspondiente para determinar el estado operativo del activo.',
  'El equipo deja de estar bajo la responsabilidad directa del funcionario receptor a partir de la firma de la presente acta.',
] as const;

export const ACTA_RETURN_CLOSING =
  'La firma de este documento constituye constancia del descargo físico del equipo anteriormente asignado, sin perjuicio de los procedimientos administrativos, contables o de inventario que correspondan posteriormente.';

/** Motivos de devolución (formulario) */
export const RETURN_REASON_OPTIONS = [
  { value: 'Sustitución / cambio de equipo', label: 'Sustitución / cambio de equipo' },
  { value: 'Traslado de funciones', label: 'Traslado de funciones' },
  { value: 'Daño o falla', label: 'Daño o falla' },
  { value: 'Otro', label: 'Otro (texto libre)' },
] as const;

export const RETURN_REASON_TERMINATION = 'Terminación de relación laboral';

export function isSubstitutionReturnReason(reason: string | null | undefined): boolean {
  const normalized = (reason ?? '').trim().toLowerCase();
  return normalized.startsWith('sustitución') || normalized.startsWith('sustitucion') || normalized.includes('cambio de equipo');
}

/** Acta 3 — Descargo laboral */
export const ACTA_DISCHARGE_TITLE = 'ACTA DE DESCARGO Y DEVOLUCIÓN DE EQUIPO';
export const ACTA_DISCHARGE_SUBTITLE = 'Terminación de relación laboral';

export const ACTA_DISCHARGE_INTRO =
  'Por medio de la presente se deja constancia de que, a partir de la fecha efectiva de terminación indicada arriba, la relación laboral entre el trabajador(a) antes identificado(a) y el **CONSEJO NACIONAL DE INVERSIONES (CNI)** concluye formalmente. En consecuencia, se solicita al trabajador(a) la devolución de todo el equipo informático, licencias de software, contraseñas, llaves y demás recursos de la institución que se encuentren bajo su custodia.';

export const ACTA_DISCHARGE_INVENTORY_INTRO =
  'A continuación, se detalla el inventario de equipo y recursos devueltos por el trabajador(a), así como el estado en que fueron recibidos:';

export const ACTA_DISCHARGE_CONFIDENTIALITY =
  '**Confidencialidad y destrucción de información:** toda la información relacionada con contraseñas y accesos deberá ser proporcionada de forma segura y confidencial. Asimismo, el trabajador(a) se compromete a eliminar y/o destruir cualquier copia física o digital de información propiedad del CNI que se encuentre en su posesión.';

export const ACTA_DISCHARGE_COORDINATION =
  '**Coordinación de la entrega:** la entrega de los ítems deberá coordinarse con el Departamento de Informática y Tecnología, el cual estará disponible para recibir el equipo y brindar la asistencia necesaria.';

export const ACTA_DISCHARGE_DECLARATION =
  '**Declaración de conformidad:** las partes que suscriben declaran que el presente inventario refleja de manera fiel y completa el equipo y los recursos devueltos, y que no existen pendientes adicionales distintos a los aquí señalados, salvo que se indique lo contrario en observaciones.';

export const ACTA_DISCHARGE_THANKS =
  'Se agradece la colaboración prestada y se desea el mayor de los éxitos en los proyectos profesionales futuros.';

export const ACTA_DISCHARGE_SIGN_CLOSING = 'En fe de lo anterior, firman:';

export const AUDIT_ACTION_EMPLOYEE_DISCHARGE_ACTA = 'EMPLOYEE_DISCHARGE_ACTA_GENERATED';
