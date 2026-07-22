import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
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
          padding: 16,
        }}
      >
        <img
          src={`data:image/png;base64,${base64}`}
          alt=""
          width={148}
          height={68}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  );
}
