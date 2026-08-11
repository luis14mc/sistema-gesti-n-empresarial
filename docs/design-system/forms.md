# Forms

Forms use React Hook Form and Zod when migrated in Phase 2D. Every control needs a visible associated label, visible validation feedback, and `aria-invalid` when invalid.

Use one column on mobile and two columns from tablet widths when fields permit. Group long forms into named sections. Long text, attachments, and justification fields span the full width.

Normalize numeric values before submission. Empty strings, `undefined`, and `NaN` must not reach Decimal calculations or API payloads. Actions use the order: Volver, Guardar cambios, workflow action.
