import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from '@/modules/purchases/infrastructure/supplier-repository';

export { createSupplier, updateSupplier, deleteSupplier, listSuppliers };

export const createProveedor = createSupplier;
export const updateProveedor = updateSupplier;
export const deleteProveedor = deleteSupplier;
