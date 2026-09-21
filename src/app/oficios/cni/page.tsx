import { redirect } from 'next/navigation';

/** Legacy URL → unified hub filtered by CNI */
export default function OficiosCniPage() {
  redirect('/oficios?dependency=CNI');
}
