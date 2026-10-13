// Downloads each story's lead image and shrinks it to a small inline WebP, so the digest is
// one self-contained file: it works as an email attachment and as a published page
// (which cannot load images from other sites).
import sharp from 'sharp';
import { get, pool } from './collect.js';

export async function embedImages(items) {
  await pool(items.filter((i) => i.image), 6, async (item) => {
    try {
      const buf = await get(item.image, { as: 'buffer', timeout: 20000 });
      const webp = await sharp(buf).resize(480, 270, { fit: 'cover', position: 'attention' }).webp({ quality: 58 }).toBuffer();
      item.imageData = `data:image/webp;base64,${webp.toString('base64')}`;
    } catch { /* card falls back to a source-initials tile */ }
  });
}
