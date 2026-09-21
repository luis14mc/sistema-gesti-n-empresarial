'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { oficiosService } from '@/services/oficios.service';
import {
  OFICIO_DEPENDENCY_LABELS,
  type OficioScope,
} from '@/lib/oficios-numbering';
import type { Oficio } from '@/types';

export type RelatedCorrespondenceSelection = {
  id: string;
  number: string;
  subject: string;
  oficioDate: string;
  scope?: string | null;
  type: string;
};

function directionLabel(type: string) {
  if (type === 'INCOMING') return 'Entrada';
  if (type === 'INTERNAL_MEMO') return 'Memo';
  return 'Salida';
}

export function RelatedCorrespondenceSelector({
  value,
  onChange,
  disabled,
}: {
  value: RelatedCorrespondenceSelection | null;
  onChange: (next: RelatedCorrespondenceSelection | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [results, setResults] = useState<Oficio[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!debounced.trim() || debounced.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    void oficiosService
      .search({ q: debounced.trim(), page: 1, pageSize: 8 })
      .then((res) => {
        if (cancelled) return;
        setResults(res.data.oficios ?? []);
        setSearched(true);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setSearched(true);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  if (value) {
    return (
      <div className="space-y-2">
        <Label>Documento al que responde / relacionado</Label>
        <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <div className="min-w-0 text-sm">
            <p className="font-medium">{value.number}</p>
            <p className="truncate text-muted-foreground">{value.subject}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(value.oficioDate), 'dd/MM/yyyy', { locale: es })}
              {' · '}
              {OFICIO_DEPENDENCY_LABELS[(value.scope as OficioScope) ?? 'CNI'] ?? value.scope ?? '—'}
              {' · '}
              {directionLabel(value.type)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label="Quitar documento relacionado"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Documento al que responde / relacionado</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por número, asunto o institución…"
        />
      </div>
      {searching ? (
        <p className="text-xs text-muted-foreground">Buscando…</p>
      ) : null}
      {searched && !searching && results.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin resultados para esta búsqueda.</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded-md border divide-y">
          {results.map((oficio) => (
            <li key={oficio.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => {
                  onChange({
                    id: oficio.id,
                    number: oficio.number,
                    subject: oficio.subject,
                    oficioDate: oficio.oficioDate,
                    scope: oficio.scope,
                    type: oficio.type,
                  });
                  setQuery('');
                  setResults([]);
                  setSearched(false);
                }}
              >
                <p className="font-medium">{oficio.number}</p>
                <p className="truncate text-muted-foreground">{oficio.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(oficio.oficioDate), 'dd/MM/yyyy', { locale: es })}
                  {' · '}
                  {OFICIO_DEPENDENCY_LABELS[(oficio.scope as OficioScope) ?? 'CNI'] ??
                    oficio.scope ??
                    '—'}
                  {' · '}
                  {directionLabel(oficio.type)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
