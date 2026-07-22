import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  const file = await readFile(
    path.join(process.cwd(), 'public/Logo_CNI.png')
  );
  const base64 = file.toString('base64');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <img
          src={`data:image/png;base64,${base64}`}
          alt=""
          width={30}
          height={14}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  );
}
