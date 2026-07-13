-- =====================================================
-- Migración: Oficio.status String -> enum OficioStatus
-- Sprint 2: cerrar el gap de tipado débil en el campo status
-- =====================================================

-- 1) Crear el enum nuevo
CREATE TYPE "OficioStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'ARCHIVED');

-- 2) Migrar el status de Oficio al enum (cualquier valor fuera del enum cae a DRAFT)
ALTER TABLE "oficios"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OficioStatus"
    USING (
      CASE
        WHEN "status" IN ('DRAFT', 'SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'ARCHIVED')
          THEN "status"::"OficioStatus"
        ELSE 'DRAFT'::"OficioStatus"
      END
    ),
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- 3) Mantener el índice existente (Prisma lo recrea en la siguiente migración si hace falta)
--    El @@index([status]) del modelo Oficio sigue siendo válido.
