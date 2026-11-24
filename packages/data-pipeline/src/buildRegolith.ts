import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { DETAIL_SIZE, regolithTile } from './apollo/terrain/regolithDetail'

// Writes the tour's tile of invented regolith (apollo/terrain/regolithDetail.ts).
const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/data/apollo11/terrain/regolith-detail.png')
await sharp(Buffer.from(regolithTile()), { raw: { width: DETAIL_SIZE, height: DETAIL_SIZE, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out)
console.log(`Wrote ${out}`)
