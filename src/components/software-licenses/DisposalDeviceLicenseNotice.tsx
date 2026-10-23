'use client';

import { useEffect, useState } from 'react';
import { api } from '@/utils/api';

type DeviceLicenseItem = {
  id: string;
  subscription: { product: { name: string }; planName: string };
};

export function DisposalDeviceLicenseNotice({
  equipmentId,
  visible,
}: {
  equipmentId: string | undefined;
  visible: boolean;
}) {
  const [items, setItems] = useState<DeviceLicenseItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!equipmentId || !visible) {
      setItems([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    api
      .get(`/api/software-licenses/equipment/${equipmentId}`)
      .then((response) => {
        if (!cancelled) {
          setItems(response.data.data.items ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId, visible]);

  if (!visible || !loaded || items.length === 0) return null;

  const count = items.length;
  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
      role="status"
      data-testid="disposal-device-license-notice"
    >
      <p>
        Este equipo tiene {count} licencia{count === 1 ? '' : 's'} instalada{count === 1 ? '' : 's'} que quedarán
        libres al aprobar la baja:
      </p>
      <ul className="mt-2 list-disc pl-5">
        {items.map((item) => (
          <li key={item.id}>
            {item.subscription.product.name}
            {item.subscription.planName ? ` · ${item.subscription.planName}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
