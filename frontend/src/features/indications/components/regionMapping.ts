import type { BodyRegion } from '../data/indicationGroups'

// Keywords matched against node names in the Z-Anatomy models, so parts of the
// model can be clicked as body regions. Legs/spine come before Head because
// names like "Head of femur" would otherwise match "head".
export const MESH_REGION_KEYWORDS: { region: BodyRegion; keywords: string[] }[] = [
  { region: 'Heart', keywords: ['heart'] },
  { region: 'Lungs', keywords: ['lung'] },
  { region: 'Eyes', keywords: ['eye'] },
  { region: 'Legs and spine', keywords: ['lower limb', 'femur', 'tibia', 'vertebra', 'vertebral column', 'foot'] },
  { region: 'Head', keywords: ['regions of head', 'cranium', 'skull', 'brain', 'cerebr'] },
  { region: 'Whole body', keywords: ['skin', 'body surface'] },
]

// Maps a mesh name in a 3D model file to a body region. Returns null for meshes that belong to no region.
export function regionForMeshName(name: string): BodyRegion | null {
  const lower = name.toLowerCase()
  for (const entry of MESH_REGION_KEYWORDS) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.region
  }
  return null
}
