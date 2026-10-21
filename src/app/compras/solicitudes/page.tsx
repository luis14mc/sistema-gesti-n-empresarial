import { permanentRedirect } from 'next/navigation';
import { resolveComprasSolicitudesRedirect } from '@/modules/purchases/domain/list-status-filter';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ComprasSolicitudesLegacyRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') urlParams.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => urlParams.append(key, v));
  }
  permanentRedirect(resolveComprasSolicitudesRedirect(urlParams));
}
