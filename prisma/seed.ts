import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const dbUrl = new URL(process.env.DATABASE_URL || '');
const pool = new Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || '5432', 10),
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️ ALERTA CRÍTICA: Se intentó ejecutar el seed en entorno de producción.');
    console.error('La operación ha sido abortada para evitar la pérdida de datos de producción.');
    process.exit(1);
  }

  console.log('🌱 Iniciando seed de la base de datos (esquema v2)...\n');

  // ── Limpieza en orden de dependencias ────────────────────────
  console.log('🗑️  Limpiando tablas...');
  await prisma.auditRecord.deleteMany();
  await prisma.promotionalMovement.deleteMany();
  await prisma.promotionalItem.deleteMany();
  await prisma.compraAdjunto.deleteMany();
  await prisma.compraSolicitudItem.deleteMany();
  await prisma.compraSolicitud.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.costCenter.deleteMany();
  await prisma.equipmentAssignment.deleteMany();
  await prisma.equipmentHistory.deleteMany();
  await prisma.equipmentMaintenance.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.oficio.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.jobPosition.deleteMany();
  await prisma.department.deleteMany();
  await prisma.attendancePolicy.deleteMany();
  console.log('   ✅ Tablas limpias\n');

  // ── Departamentos ───────────────────────────────────────────
  console.log('🏢 Creando departamentos...');
  const deptTI = await prisma.department.create({
    data: { name: 'Tecnologías de la Información', description: 'Soporte, infraestructura y desarrollo' },
  });
  const deptRRHH = await prisma.department.create({
    data: { name: 'Recursos Humanos', description: 'Gestión del talento y nóminas' },
  });
  const deptAdmin = await prisma.department.create({
    data: { name: 'Administración', description: 'Dirección general y finanzas' },
  });
  const deptOps = await prisma.department.create({
    data: { name: 'Operaciones', description: 'Logística y operaciones de campo' },
  });
  console.log('   ✅ 4 departamentos creados');

  // ── Puestos de trabajo ──────────────────────────────────────
  console.log('💼 Creando puestos de trabajo...');
  const posDirector = await prisma.jobPosition.create({
    data: { name: 'Director General', departmentId: deptAdmin.id },
  });
  const posJefeTI = await prisma.jobPosition.create({
    data: { name: 'Jefe de TI', departmentId: deptTI.id },
  });
  const posSoporteTI = await prisma.jobPosition.create({
    data: { name: 'Soporte Técnico', departmentId: deptTI.id },
  });
  const posJefeRRHH = await prisma.jobPosition.create({
    data: { name: 'Jefe de RRHH', departmentId: deptRRHH.id },
  });
  const posAnalista = await prisma.jobPosition.create({
    data: { name: 'Analista de Operaciones', departmentId: deptOps.id },
  });
  console.log('   ✅ 5 puestos creados');

  // ── Políticas de asistencia ─────────────────────────────────
  console.log('⏰ Creando políticas de asistencia...');
  await prisma.attendancePolicy.create({
    data: {
      name: 'Horario Estándar',
      officialCheckIn: '08:00',
      officialCheckOut: '17:00',
      toleranceMinutes: 15,
    },
  });
  await prisma.attendancePolicy.create({
    data: {
      name: 'Horario Flexible',
      officialCheckIn: '09:00',
      officialCheckOut: '18:00',
      toleranceMinutes: 30,
    },
  });
  console.log('   ✅ 2 políticas creadas');

  // ── Usuarios ────────────────────────────────────────────────
  console.log('👤 Creando usuarios...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      employeeNumber: 'EMP-001',
      email: 'admin@empresa.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Sistema',
      role: 'ADMIN',
      departmentId: deptAdmin.id,
      positionId: posDirector.id,
    },
  });

  const jefeTI = await prisma.user.create({
    data: {
      employeeNumber: 'EMP-002',
      email: 'ti@empresa.com',
      password: hashedPassword,
      firstName: 'Carlos',
      lastName: 'Ramírez',
      role: 'IT',
      departmentId: deptTI.id,
      positionId: posJefeTI.id,
      phone: '555-0102',
    },
  });

  const jefeRRHH = await prisma.user.create({
    data: {
      employeeNumber: 'EMP-003',
      email: 'rrhh@empresa.com',
      password: hashedPassword,
      firstName: 'María',
      lastName: 'López',
      role: 'RRHH',
      departmentId: deptRRHH.id,
      positionId: posJefeRRHH.id,
      phone: '555-0103',
    },
  });

  const user1 = await prisma.user.create({
    data: {
      employeeNumber: 'EMP-004',
      email: 'juan@empresa.com',
      password: hashedPassword,
      firstName: 'Juan',
      lastName: 'Pérez',
      role: 'USER',
      departmentId: deptOps.id,
      positionId: posAnalista.id,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      employeeNumber: 'EMP-005',
      email: 'lucia@empresa.com',
      password: hashedPassword,
      firstName: 'Lucía',
      lastName: 'González',
      role: 'USER',
      departmentId: deptTI.id,
      positionId: posSoporteTI.id,
    },
  });

  console.log('   ✅ 5 usuarios creados');

  // ── Empleados (para asignación de equipos) ───────────────────
  console.log('👥 Creando empleados...');
  const empJuan = await prisma.employee.create({
    data: {
      employeeCode: 'EMP-004',
      firstName: 'Juan',
      lastName: 'Pérez',
      fullName: 'Juan Pérez',
      email: 'juan@empresa.com',
      userId: user1.id,
      departmentId: deptOps.id,
      positionId: posAnalista.id,
    },
  });
  await prisma.employee.create({
    data: {
      employeeCode: 'EMP-005',
      firstName: 'Lucía',
      lastName: 'González',
      fullName: 'Lucía González',
      email: 'lucia@empresa.com',
      userId: user2.id,
      departmentId: deptTI.id,
      positionId: posSoporteTI.id,
    },
  });
  await prisma.employee.create({
    data: {
      employeeCode: 'EMP-002',
      firstName: 'Carlos',
      lastName: 'Ramírez',
      fullName: 'Carlos Ramírez',
      email: 'ti@empresa.com',
      userId: jefeTI.id,
      departmentId: deptTI.id,
      positionId: posJefeTI.id,
    },
  });
  console.log('   ✅ 3 empleados creados');

  // ── Tickets ─────────────────────────────────────────────────
  console.log('🎫 Creando tickets...');
  await prisma.ticket.create({
    data: {
      title: 'Impresora del 3er piso no funciona',
      description: 'La impresora HP LaserJet del tercer piso no imprime y muestra error de atasco de papel.',
      type: 'HARDWARE',
      priority: 'HIGH',
      status: 'OPEN',
      createdById: user1.id,
      assignedToId: jefeTI.id,
      comments: JSON.stringify([
        { author: jefeTI.firstName, date: new Date().toISOString(), text: 'Revisando el problema ahora' },
      ]),
    },
  });

  await prisma.ticket.create({
    data: {
      title: 'Actualización de software de contabilidad',
      description: 'Se requiere actualizar el software ContaPyme a la versión 2026.',
      type: 'SOFTWARE',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      createdById: user2.id,
      assignedToId: jefeTI.id,
    },
  });
  console.log('   ✅ 2 tickets creados');

  // ── Oficios ─────────────────────────────────────────────────
  console.log('📄 Creando oficios...');
  await prisma.oficio.create({
    data: {
      number: 'CNI-001-2026',
      type: 'INTERNAL_MEMO',
      subject: 'Solicitud de vacaciones',
      status: 'SENT',
      attachments: JSON.stringify([]),
      oficioDate: new Date('2026-02-01'),
      sentDate: new Date('2026-02-02'),
      createdById: user1.id,
    },
  });

  await prisma.oficio.create({
    data: {
      number: 'DPICP-001-2026',
      type: 'OUTGOING',
      subject: 'Informe mensual de actividades',
      status: 'SENT',
      attachments: JSON.stringify(['informe_enero_2026.pdf']),
      oficioDate: new Date('2026-01-31'),
      sentDate: new Date('2026-02-01'),
      createdById: admin.id,
    },
  });
  console.log('   ✅ 2 oficios creados');

  // ── Asistencia ──────────────────────────────────────────────
  console.log('🕐 Creando registros de asistencia...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkInTime = new Date(today);
  checkInTime.setHours(8, 5, 0, 0);

  const checkOutTime = new Date(today);
  checkOutTime.setHours(17, 10, 0, 0);

  await prisma.timeEntry.create({
    data: {
      userId: user1.id,
      date: today,
      checkIn: checkInTime,
      checkOut: checkOutTime,
      latitude: 14.6349,
      longitude: -90.5069,
      status: 'ON_TIME',
    },
  });

  await prisma.timeEntry.create({
    data: {
      userId: jefeTI.id,
      date: today,
      checkIn: new Date(new Date(today).setHours(8, 25, 0, 0)),
      latitude: 14.6349,
      longitude: -90.5069,
      status: 'LATE',
      notes: 'Tráfico en zona 10',
    },
  });
  console.log('   ✅ 2 registros de asistencia creados');

  // ── Equipos ─────────────────────────────────────────────────
  console.log('💻 Creando equipos...');
  const laptop1 = await prisma.equipment.create({
    data: {
      inventoryCode: 'TI-LAP-0001',
      category: 'LAPTOP',
      type: 'LAPTOP',
      brand: 'Dell',
      model: 'Latitude 5440',
      serialNumber: 'DL5440-2024-001',
      status: 'ASSIGNED',
      purchaseDate: new Date('2024-01-15'),
      warrantyDate: new Date('2027-01-15'),
      ram: '16 GB DDR5',
      processor: 'Intel Core i7-1355U',
      storage: '512 GB NVMe SSD',
      os: 'Windows 11 Pro',
    },
  });

  const laptop2 = await prisma.equipment.create({
    data: {
      inventoryCode: 'TI-LAP-0002',
      category: 'LAPTOP',
      type: 'LAPTOP',
      brand: 'HP',
      model: 'ProBook 450 G10',
      serialNumber: 'HP450G10-2024-002',
      status: 'AVAILABLE',
      purchaseDate: new Date('2024-03-20'),
      warrantyDate: new Date('2027-03-20'),
      ram: '16 GB DDR4',
      processor: 'Intel Core i5-1335U',
      storage: '1 TB NVMe SSD',
      os: 'Windows 11 Pro',
    },
  });

  await prisma.equipment.create({
    data: {
      inventoryCode: 'TI-MON-0001',
      category: 'MONITOR',
      type: 'MONITOR',
      brand: 'LG',
      model: '27MP59G',
      serialNumber: 'LG27-2024-001',
      status: 'AVAILABLE',
      purchaseDate: new Date('2024-02-10'),
    },
  });

  await prisma.equipment.create({
    data: {
      inventoryCode: 'TI-IMP-0001',
      category: 'PRINTER',
      type: 'PRINTER',
      brand: 'HP',
      model: 'LaserJet Pro M404dn',
      serialNumber: 'HPLJ-2024-001',
      status: 'AVAILABLE',
      purchaseDate: new Date('2024-01-05'),
    },
  });
  console.log('   ✅ 4 equipos creados');

  // ── Asignaciones de equipo ──────────────────────────────────
  console.log('🔗 Creando asignaciones...');
  await prisma.equipmentAssignment.create({
    data: {
      equipmentId: laptop1.id,
      employeeId: empJuan.id,
      userId: user1.id,
      status: 'ACTIVE',
      assignedDate: new Date('2024-02-01'),
      departmentAtTime: 'Operaciones',
      positionAtTime: 'Analista de Operaciones',
      employeeNameAtTime: 'Juan Pérez',
      employeeEmailAtTime: 'juan@empresa.com',
      deliveryReason: 'Nuevo ingreso',
      notes: 'Equipo asignado para trabajo remoto',
    },
  });

  await prisma.equipmentHistory.create({
    data: {
      equipmentId: laptop1.id,
      action: 'ASSIGNED',
      title: 'Equipo asignado',
      description: 'TI-LAP-0001 asignado a Juan Pérez, Operaciones, Analista de Operaciones.',
    },
  });
  console.log('   ✅ 1 asignación creada');

  // ── Items promocionales ─────────────────────────────────────
  console.log('🎁 Creando inventario promocional...');
  const promo1 = await prisma.promotionalItem.create({
    data: {
      inventoryCode: 'CNI-Prom-F001',
      name: 'Bolígrafo corporativo',
      description: 'Bolígrafo con logo institucional',
      quantity: 500,
      unitPrice: 0.5,
      purchaseDate: new Date('2025-12-01'),
    },
  });

  await prisma.promotionalItem.create({
    data: {
      inventoryCode: 'CNI-Prom-F002',
      name: 'USB 16GB',
      description: 'Memoria USB con logo corporativo',
      quantity: 100,
      unitPrice: 5.0,
      purchaseDate: new Date('2025-12-15'),
    },
  });

  await prisma.promotionalItem.create({
    data: {
      inventoryCode: 'CNI-Prom-F003',
      name: 'Taza térmica',
      description: 'Taza térmica con logo institucional',
      quantity: 200,
      unitPrice: 8.0,
      purchaseDate: new Date('2025-12-15'),
    },
  });

  await prisma.promotionalMovement.create({
    data: {
      itemId: promo1.id,
      type: 'EXIT',
      quantityOut: 50,
      movementDate: new Date('2026-01-20'),
      eventName: 'Feria Tecnológica Guatemala 2026',
      eventLocation: 'Centro de Convenciones, Zona 13',
      eventDate: new Date('2026-01-22'),
      responsible: 'Carlos Ramírez',
      comments: 'Distribución en stand institucional',
    },
  });
  console.log('   ✅ 3 items + 1 movimiento creados');

  // ── Centros de costo y proveedores ──────────────────────────
  console.log('🏷️  Creando centros de costo y proveedores...');
  const ccTI = await prisma.costCenter.create({
    data: { code: 'CC-TI-001', name: 'Infraestructura TI', description: 'Equipos y licencias' },
  });
  const ccOps = await prisma.costCenter.create({
    data: { code: 'CC-OPS-001', name: 'Operaciones de campo', description: 'Logística y operaciones' },
  });
  const proveedorTech = await prisma.proveedor.create({
    data: {
      nombreRazonSocial: 'Tecnología Empresarial S.A.',
      rtn: '08011990123456',
      telefono: '2234-5678',
      email: 'ventas@tecnologia.hn',
      personaContacto: 'María López',
      direccion: 'Blvd. Morazán, Tegucigalpa',
    },
  });
  console.log('   ✅ 2 centros de costo + 1 proveedor creados');

  // ── Solicitudes de compra ───────────────────────────────────
  console.log('🛒 Creando solicitudes de compra...');
  await prisma.compraSolicitud.create({
    data: {
      codigoSolicitud: 'SC-0001-2026',
      fechaSolicitud: new Date('2026-07-01'),
      fechaRequerida: new Date('2026-07-20'),
      departamentoSolicitanteId: deptTI.id,
      centroCostoId: ccTI.id,
      solicitadoPorId: jefeTI.id,
      cargoSolicitante: 'Jefe de TI',
      tipoCompra: 'BIENES',
      prioridad: 'ALTA',
      estado: 'PENDIENTE_AUTORIZACION_JEFE',
      proveedorId: proveedorTech.id,
      justificacionCompra: 'Adquisición de laptops para nuevo personal de operaciones según plan 2026.',
      condicionesEntrega: 'Entrega en oficinas centrales en 10 días hábiles.',
      formaPago: 'CREDITO',
      plazoPagoDias: 30,
      subtotal: 125000,
      descuento: 0,
      impuesto: 18750,
      total: 143750,
      items: {
        create: [
          {
            item: 1,
            codigo: 'LT-DELL-01',
            descripcion: 'Laptop Dell Latitude 5540',
            unidad: 'UNIDAD',
            cantidad: 5,
            precioUnitario: 25000,
            total: 125000,
          },
        ],
      },
    },
  });
  console.log('   ✅ 1 solicitud de compra creada');

  // ── Registro de auditoría ───────────────────────────────────
  console.log('📋 Creando registros de auditoría...');
  await prisma.auditRecord.create({
    data: {
      title: 'Seed inicial del sistema',
      description: 'Carga inicial de datos de prueba para el sistema de gestión empresarial v2.',
      module: 'MANUAL',
      category: 'SISTEMA',
      priority: 'BAJA',
      status: 'COMPLETADO',
      userId: admin.id,
    },
  });
  console.log('   ✅ 1 registro de auditoría creado');

  // ── Resumen ─────────────────────────────────────────────────
  console.log('\n🎉 ¡Seed completado exitosamente!\n');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       CREDENCIALES DE ACCESO (dev)          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║ Admin:  admin@empresa.com  / password123    ║');
  console.log('║ TI:     ti@empresa.com     / password123    ║');
  console.log('║ RRHH:   rrhh@empresa.com   / password123    ║');
  console.log('║ User 1: juan@empresa.com   / password123    ║');
  console.log('║ User 2: lucia@empresa.com  / password123    ║');
  console.log('╚══════════════════════════════════════════════╝');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
