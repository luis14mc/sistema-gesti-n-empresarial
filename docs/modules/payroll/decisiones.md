# Decisiones de implementación — módulo Nómina (dominio)

## Referencia legacy ausente

No existe `server.py` ni otro artefacto de cálculo de planilla del sistema legacy en este repositorio. Las reglas se tomaron del documento funcional **Contexto pagos CNI v2.2.0** y de los casos dorados acordados en especificación; cualquier divergencia futura debe validarse contra planillas históricas exportadas.

## ISR mensual = ISR anual ÷ n

La retención del mes no se calcula sobre el salario del periodo aislado. Se proyecta el ingreso anual (según primer mes o año completo), se aplican deducciones legales, se obtiene la **renta neta gravable anual**, se aplica la tabla progresiva SAR 2026 y el impuesto anual resultante se divide entre **n** (`monthsWorkedInYear`: meses desde el mes de contratación hasta diciembre del mismo año, o 12 si el ingreso es anterior al año fiscal).

## Detección de “primer mes”

Se considera **primer mes** cuando la fecha de contratación cae en el **mismo mes y año calendario** que el cierre del periodo de pago (día 20 del mes de `payMonth`). En ese escenario la proyección anual es:

`salarioPeriodo + salarioMensual × (n − 1)`

En los demás casos: `salarioMensual × n`.

## Prorrateo de salario

Si el colaborador ingresa después del inicio del periodo (20 del mes anterior) pero en el mes del pago, el salario del periodo se prorratea con base 30 días desde la fecha de contratación hasta el **último día del mes de pago** (convención que reproduce los casos dorados del spec).

## IHSS

Base = `min(salarioPeriodo, techoMensual)` con techo CNI 2026 **L 11,903.13**. Tasas: EM **2.5%** + IVM **2.5%** sobre esa base (caso «normal» → L 595.16; salario L 10,000 → L 500.00). No hay piso artificial distinto al cálculo sobre la base.

## Deducción IVM para ISR

Se usa el monto mensual configurable `ivmDeductibleMonthly` (default 2026: L 297.58), alineado con la porción deducible de IVM, no el total IHSS descontado en nómina.

## Envío de recibos por correo

**TODO:** Integrar envío de PDF de planilla por email (campo `emailStatus` / `emailError` en `Payslip`). No implementado en esta fase; la generación persiste PDF en storage y expone descarga vía API.
