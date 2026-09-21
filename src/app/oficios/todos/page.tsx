import { redirect } from 'next/navigation';

/** Legacy todos → unified hub */
export default function TodosOficiosPage() {
  redirect('/oficios');
}
