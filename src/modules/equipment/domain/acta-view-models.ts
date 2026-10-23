export type ActaParty = {
  name: string;
  position: string;
  department: string;
};

export type ActaEquipmentSnapshot = {
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  inventoryNumber: string | null;
  ram: string | null;
  processor: string | null;
  storage: string | null;
  operatingSystem: string | null;
  accessories: string | null;
  softwareInstalled: string | null;
  returnCondition?: string | null;
  returnNotes?: string | null;
};

export type AssignmentActaViewModel = {
  documentDate: Date;
  recipient: ActaParty;
  deliverer: ActaParty;
  equipment: ActaEquipmentSnapshot;
  equipmentDeliveryState: 'nuevo' | 'en buen estado';
};

export type ReturnActaViewModel = {
  documentDate: Date;
  recipient: ActaParty;
  deliverer: ActaParty;
  returnReason: string | null;
  equipment: ActaEquipmentSnapshot;
};

export type DischargeActaTableRow = Record<string, string>;

export type DischargeActaViewModel = {
  documentDate: Date;
  terminationDate: Date;
  workerName: string;
  workerDni: string;
  workerPosition: string;
  deliverer: ActaParty;
  equipmentRows: DischargeActaTableRow[];
  accessoryRows: DischargeActaTableRow[];
  licenseRows: DischargeActaTableRow[];
  accessRows: DischargeActaTableRow[];
  miscRows: DischargeActaTableRow[];
};
