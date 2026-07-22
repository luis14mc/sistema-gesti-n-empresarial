'use client';

import { DisposalDocument, type DisposalDocumentData } from './DisposalDocument';

export function DisposalPreviewClient({ data, draft = false }: { data: DisposalDocumentData; draft?: boolean }) {
  return <div className="overflow-auto rounded-lg bg-muted p-4"><div className="mx-auto min-h-[1056px] w-[816px] bg-white p-[45px] shadow-lg"><DisposalDocument data={data} draft={draft} /></div></div>;
}
