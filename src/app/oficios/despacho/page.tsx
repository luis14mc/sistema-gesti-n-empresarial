import { redirect } from 'next/navigation';

/** Legacy URL → unified hub filtered by Despacho */
export default function OficiosDespachoPage() {
  redirect('/oficios?dependency=DESPACHO');
}
