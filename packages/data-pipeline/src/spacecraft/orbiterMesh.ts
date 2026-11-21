// A mesh in the Orbiter space flight simulator's text format (MSHX1), as Project Apollo - NASSP's
// spacecraft are: groups of triangles, each with a label, a material (its colour) and a texture
// (a DDS file, or none). Positions in metres in Orbiter's left-handed frame (x right, y up, z
// forward); materials and textures are numbered from 1, 0 meaning none.

export interface OrbiterGroup {
  label: string
  // Index into `materials`, or null; the texture's path as the mesh names it, or null.
  material: number | null
  texture: string | null
  positions: Float32Array
  // Normals and texture coordinates, where the group has them.
  normals: Float32Array | null
  uvs: Float32Array | null
  indices: Uint32Array
}

export interface OrbiterMaterial {
  name: string
  diffuse: [number, number, number, number]
}

export interface OrbiterMesh {
  groups: OrbiterGroup[]
  materials: OrbiterMaterial[]
  textures: string[]
}

// A line without its comment, split into words.
function words(line: string): string[] {
  return line.split(';')[0].trim().split(/\s+/).filter(Boolean)
}

interface GroupHeader {
  label: string
  material: number
  texture: number
}

export function readOrbiterMesh(text: string): OrbiterMesh {
  const lines = text.split(/\r?\n/)
  const sections = { materials: [] as OrbiterMaterial[], textures: [] as string[] }
  const raw: { header: GroupHeader; at: number }[] = []
  let header: GroupHeader = { label: '', material: 0, texture: 0 }
  lines.forEach((line, i) => {
    const [key, value] = words(line)
    if (key === 'GEOM') {
      raw.push({ header, at: i })
      header = { ...header, label: '' }
    } else if (key === 'MATERIALS') sections.materials = readMaterials(lines, i)
    else if (key === 'TEXTURES') sections.textures = lines.slice(i + 1, i + 1 + Number(value)).map((entry) => entry.trim())
    else if (sections.materials.length === 0) header = groupHeader(header, line, key, value)
  })
  return { groups: raw.map(({ header: h, at }) => readGroup(lines, at, h, sections.textures)), ...sections }
}

// A group's settings before its GEOM line (a group keeps its predecessor's material and texture
// unless it names its own). The MATERIAL blocks after MATERIALS are read apart.
function groupHeader(header: GroupHeader, line: string, key: string | undefined, value: string | undefined): GroupHeader {
  if (key === 'LABEL') return { ...header, label: line.trim().slice(6).trim() }
  if (key === 'MATERIAL') return { ...header, material: Number(value) }
  if (key === 'TEXTURE') return { ...header, texture: Number(value) }
  return header
}

function readGroup(lines: string[], at: number, { label, material, texture }: GroupHeader, textures: string[]): OrbiterGroup {
  const [, nv, nt] = words(lines[at]).map(Number)
  const rows = lines.slice(at + 1, at + 1 + nv).map((line) => words(line).map(Number))
  // Rows are read one by one: some meshes leave a row's normal or texture coordinates out.
  const layouts = rows.map((row) => columns(row.length))
  const normals = layouts.every((layout) => layout.normals !== null) ? Float32Array.from(rows.flatMap((row) => row.slice(3, 6))) : null
  const uvs = layouts.some((layout) => layout.uvs !== null) ? Float32Array.from(rows.flatMap((row, i) => (layouts[i].uvs === null ? [0, 0] : row.slice(layouts[i].uvs ?? 0, (layouts[i].uvs ?? 0) + 2)))) : null
  const indices = Uint32Array.from(lines.slice(at + 1 + nv, at + 1 + nv + nt).flatMap((line) => words(line).slice(0, 3).map(Number)))
  return {
    label,
    material: material > 0 ? material - 1 : null,
    texture: texture > 0 ? (textures[texture - 1] ?? null) : null,
    positions: Float32Array.from(rows.flatMap((row) => row.slice(0, 3))),
    normals,
    uvs,
    indices,
  }
}

// Where a vertex row's normal and texture coordinates start (by how many numbers it has), if at all.
function columns(width: number): { normals: number | null; uvs: number | null } {
  const normals = width >= 6 ? 3 : null
  const uvs = width === 8 ? 6 : width === 5 ? 3 : null
  return { normals, uvs }
}

// The materials: their names, then per material its name and four lines (diffuse first).
function readMaterials(lines: string[], at: number): OrbiterMaterial[] {
  const count = Number(words(lines[at])[1])
  const names = lines.slice(at + 1, at + 1 + count).map((line) => line.trim())
  const materials: OrbiterMaterial[] = []
  for (let i = at + 1 + count; i < lines.length && materials.length < count; i++) {
    const [key] = words(lines[i])
    if (key !== 'MATERIAL') continue
    const diffuse = words(lines[i + 1]).slice(0, 4).map(Number) as [number, number, number, number]
    materials.push({ name: names[materials.length] ?? '', diffuse })
  }
  return materials
}
