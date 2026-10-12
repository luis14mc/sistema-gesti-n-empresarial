import type { Equipment } from '@/types';

export function EquipmentSelectedSummary({ equipment }: { equipment: Equipment }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
      <span>Inventario: <strong>{equipment.inventoryCode}</strong></span>
      <span>Marca / Modelo: <strong>{equipment.brand} {equipment.model}</strong></span>
      <span>Serie: <strong>{equipment.serialNumber ?? '—'}</strong></span>
      <span>RAM: <strong>{equipment.ram ?? '—'}</strong></span>
      <span>Procesador: <strong>{equipment.processor ?? '—'}</strong></span>
      <span>Almacenamiento: <strong>{equipment.storage ?? '—'}</strong></span>
      <span>Sistema operativo: <strong>{equipment.os ?? '—'}</strong></span>
      <span>Accesorios: <strong>{equipment.includedAccessories ?? '—'}</strong></span>
      <span className="col-span-2">Software: <strong>{equipment.installedSoftware ?? '—'}</strong></span>
    </div>
  );
}
