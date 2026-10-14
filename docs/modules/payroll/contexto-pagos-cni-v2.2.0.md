# Contexto pagos CNI v2.2.0 — Resumen de reglas de cálculo

Documento de referencia funcional para el dominio de nómina en `src/modules/payroll/domain/`. Resume las reglas implementadas para Honduras (ejercicio 2026).

## Periodo de pago

- Entrada: mes de pago `YYYY-MM`.
- **Inicio:** día 20 del mes calendario anterior.
- **Fin:** día 20 del mes elegido.
- El periodo incluye metadatos `year` y `month` del mes de pago.

## Salario del periodo

- Salario mensual contractual de referencia.
- Si el ingreso es posterior al inicio del periodo y en el mes del pago, aplicar **prorrateo** (base 30 días, días trabajados hasta fin de mes calendario del pago).
- En caso contrario, salario del periodo = salario mensual completo.

## IHSS (empleado)

- Base: **salario mensual contractual** (ignora prorrateo del periodo).
- Por encima del umbral bajo (L 10,000): retención máxima sobre techo (L 595.16 en 2026).
- En o por debajo del umbral: 2.5 % con piso L 500.00.
- Montos finales redondeados **half-up** a 2 decimales.

## ISR (retención asalariados, Art. 22)

- Tabla progresiva SAR **2026** (tramos exento, 15 %, 20 %, 25 % sobre renta neta gravable anual).
- **n** = meses trabajados en el año fiscal (desde mes de contratación a diciembre; 12 si ya laboraba antes del año).
- Deducciones anuales prorrateadas: gastos médicos (`medicalExpensesAnnual × n / 12`) más deducción IVM mensual acumulada (`ivmDeductibleMonthly × n`).
- **Renta neta** = máximo entre 0 y (proyección anual − deducciones).
- **Primer mes:** misma anualidad y mes de contratación que el cierre del periodo → proyección = salario del periodo + salario mensual × (n − 1).
- **Resto:** proyección = salario mensual × n.
- Impuesto del mes = impuesto anual ÷ n.

## Recibo / payslip

Combina salario del periodo, IHSS, ISR, otras deducciones configurables y **neto a pagar**, cada concepto redondeado a 2 decimales.

## Errores de dominio

- Contratación posterior al año del pago: `EMPLOYEE_NOT_YET_HIRED` (`monthsWorkedInYear` = 0).

## Constantes por defecto 2026

Definidas en `src/modules/payroll/domain/constants.ts` (tabla ISR, techo IHSS, gastos médicos L 40,000, IVM deducible L 297.58/mes, aporte mínimo IHSS L 500).
