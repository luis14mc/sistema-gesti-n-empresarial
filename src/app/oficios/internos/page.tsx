import { redirect } from 'next/navigation';

/** Legacy URL → unified hub filtered by Internos */
export default function OficiosInternosPage() {
  redirect('/oficios?dependency=INTERNO');
}
