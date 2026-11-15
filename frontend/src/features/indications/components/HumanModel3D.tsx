// Code was assisted with Claude.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { aggregateStatus, type AlertStatus, type BodyRegion, type IndicationItem } from '../data/indicationGroups'
import { regionForMeshName } from './regionMapping'

// Anatomy study models (muscular system), one per body type.
export const MODEL_FILES = {
  male: '/models/male-muscular.glb',
  female: '/models/female-muscular.glb',
} as const
// Which body model to show.
export type BodySex = keyof typeof MODEL_FILES

// The same six hotspots as the 2D body map, placed on the 3D model.
const HOTSPOT_REGIONS: BodyRegion[] = ['Head', 'Eyes', 'Heart', 'Lungs', 'Whole body', 'Legs and spine']

// Same colours as the 2D map.
const STATUS_COLOR: Record<AlertStatus, number> = {
  nominal: 0x10b981,
  warning: 0xf59e0b,
  critical: 0xc62828,
  unknown: 0x64748b,
}

// The glow colour of an organ when its region has a warning or alert.
const STATUS_EMISSIVE: Record<AlertStatus, number> = {
  nominal: 0x000000,
  warning: 0x6b4a00,
  critical: 0x6b0000,
  unknown: 0x000000,
}

// Props of the 3D model: the body type, the indicators (for colours), the selected region and the callback.
interface HumanModel3DProps {
  sex: BodySex
  items: IndicationItem[]
  selectedRegion: BodyRegion | 'ALL'
  onSelectRegion: (region: BodyRegion | 'ALL') => void
}

// A mesh of the 3D model that belongs to one body region, so it can be highlighted.
interface RegionMesh {
  mesh: THREE.Mesh
  region: BodyRegion
}

// A marker on the 3D model: a sphere (the core) with a pulsing ring around it when the region needs attention.
interface Hotspot {
  region: BodyRegion
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
}

// The worst status of the indicators in one region (used to colour its marker).
function regionStatus(items: IndicationItem[], region: BodyRegion): AlertStatus {
  return aggregateStatus(items.filter((i) => i.region === region))
}

// Positions for the hotspots as fractions of the body's height and width,
// used when the model has no named organ meshes (the anatomy study models).
const FALLBACK_ANCHORS: Record<BodyRegion, [number, number, number]> = {
  Head: [0, 0.92, 0],
  Eyes: [0, 0.9, 0],
  Heart: [0.05, 0.72, 0],
  Lungs: [-0.07, 0.75, 0],
  'Whole body': [0, 0.6, 0],
  'Legs and spine': [0, 0.3, 0],
  'Habitat panel': [0, 0.5, 0],
}

// Where to put a marker when the model has no named organ mesh: a fixed point on the body, as a fraction of its height and width.
function fallbackAnchor(region: BodyRegion, box: THREE.Box3, size: THREE.Vector3): THREE.Vector3 {
  const [fx, fy, fz] = FALLBACK_ANCHORS[region]
  return new THREE.Vector3(
    fx * size.x,
    box.min.y + fy * size.y,
    fz * size.z,
  )
}

// Finds which body region a mesh belongs to: an explicit region tag if it has one, otherwise the
// keywords in its name, or else the name of its parent object (see regionMapping.ts).
function regionOf(obj: THREE.Object3D): BodyRegion | null {
  if (obj.userData.region) return obj.userData.region as BodyRegion
  return regionForMeshName(obj.name) ?? regionForMeshName(obj.parent?.name ?? '')
}

// The 3D body model, drawn with three.js. It loads the GLB file for the chosen body type, fits the camera to it, places one marker per region, and lets the user click markers or organs to filter the indicators.
export function HumanModel3D({ sex, items, selectedRegion, onSelectRegion }: HumanModel3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const meshesRef = useRef<RegionMesh[]>([])
  const hotspotsRef = useRef<Hotspot[]>([])
  const onSelectRef = useRef(onSelectRegion)
  const selectedRef = useRef(selectedRegion)
  const itemsRef = useRef(items)
  const applyHotspotStateRef = useRef<() => void>(() => {})

  useEffect(() => {
    onSelectRef.current = onSelectRegion
    selectedRef.current = selectedRegion
  }, [onSelectRegion, selectedRegion])

  // Scene setup: load the models once, then render with orbit controls, hotspots and click picking.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0)
    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = `${w}px`
      renderer.domElement.style.height = `${h}px`
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000)
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const light = new THREE.DirectionalLight(0xffffff, 1.2)
    light.position.set(3, 5, 4)
    scene.add(light)

    const root = new THREE.Group()
    scene.add(root)
    const hotspotGroup = new THREE.Group()
    scene.add(hotspotGroup)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false

    itemsRef.current = items
    applyHotspotStateRef.current = () => applyHotspotState()
    let frame = 0
    let disposed = false
    const loader = new GLTFLoader()

    Promise.all([loader.loadAsync(MODEL_FILES[sex])]).then((gltfs) => {
      if (disposed) return
      const found: RegionMesh[] = []
      for (const gltf of gltfs) {
        root.add(gltf.scene)
        gltf.scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return
          const region = regionOf(obj)
          if (!region) return
          obj.material = Array.isArray(obj.material)
            ? obj.material.map((m) => m.clone())
            : obj.material.clone()
          found.push({ mesh: obj, region })
        })
      }
      meshesRef.current = found

      // Center and fit the whole body in view.
      const box = new THREE.Box3().setFromObject(root)
      const center = box.getCenter(new THREE.Vector3())
      root.position.sub(center)
      root.updateMatrixWorld(true)
      const fitted = new THREE.Box3().setFromObject(root)
      const size = fitted.getSize(new THREE.Vector3())
      const dist = (size.y / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25
      camera.position.set(0, 0, dist)
      controls.target.set(0, 0, 0)
      controls.minDistance = dist * 0.3
      controls.maxDistance = dist * 3
      controls.update()

      // Hotspot anchors: centre of the organ group for each region, in world space.
      const sums = new Map<BodyRegion, { sum: THREE.Vector3; n: number }>()
      const c = new THREE.Vector3()
      for (const { mesh, region } of found) {
        const b = new THREE.Box3().setFromObject(mesh)
        if (b.isEmpty()) continue
        b.getCenter(c)
        const entry = sums.get(region) ?? { sum: new THREE.Vector3(), n: 0 }
        entry.sum.add(c)
        entry.n += 1
        sums.set(region, entry)
      }
      const radius = size.y * 0.03
      const hotspots: Hotspot[] = HOTSPOT_REGIONS.map((region) => {
        const entry = sums.get(region)
        const anchor =
          entry && entry.n > 0
            ? entry.sum.clone().multiplyScalar(1 / entry.n)
            : fallbackAnchor(region, fitted, size)
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 20, 16),
          new THREE.MeshBasicMaterial({ color: STATUS_COLOR.nominal, depthTest: false }),
        )
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius * 1.4, radius * 1.7, 32),
          new THREE.MeshBasicMaterial({
            color: STATUS_COLOR.nominal,
            transparent: true,
            opacity: 0,
            depthTest: false,
            side: THREE.DoubleSide,
          }),
        )
        core.position.copy(anchor)
        ring.position.copy(anchor)
        core.renderOrder = 10
        ring.renderOrder = 10
        core.userData.region = region
        ring.userData.region = region
        hotspotGroup.add(core, ring)
        return { region, core, ring }
      })
      hotspotsRef.current = hotspots
      applyHotspotState()
    }).catch((err) => console.error('Failed to load body model', err))

    // Click picking: hotspots first, then organ meshes. Short clicks only (drags orbit).
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downX = 0
    let downY = 0
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      const hotHits = raycaster.intersectObjects(hotspotGroup.children, false)
      const pick = (region: BodyRegion) => {
        onSelectRef.current(selectedRef.current === region ? 'ALL' : region)
      }
      if (hotHits.length > 0) {
        const region = hotHits[0].object.userData.region as BodyRegion
        pick(region)
        return
      }
      const hits = raycaster.intersectObject(root, true)
      for (const hit of hits) {
        const region = regionOf(hit.object)
        if (region) {
          onSelectRef.current(region)
          return
        }
      }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.update()
      // Pulse rings on hotspots with warnings or criticals, and keep rings facing the camera.
      const t = (performance.now() / 1000) % 1.4 / 1.4
      for (const h of hotspotsRef.current) {
        h.ring.quaternion.copy(camera.quaternion)
        if (h.ring.userData.pulse) {
          h.ring.scale.setScalar(1 + 0.9 * t)
          h.ring.material.opacity = 0.85 * (1 - t)
        }
      }
      renderer.render(scene, camera)
    }
    resize()
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }

    // Applies status colours, pulse rings and selection size to the hotspots.
    function applyHotspotState() {
      const currentItems = itemsRef.current
      const current = selectedRef.current
      for (const h of hotspotsRef.current) {
        const status = regionStatus(currentItems, h.region)
        h.core.material.color.setHex(STATUS_COLOR[status])
        h.ring.material.color.setHex(STATUS_COLOR[status])
        h.ring.userData.pulse = status !== 'nominal'
        if (!h.ring.userData.pulse) {
          h.ring.material.opacity = 0
          h.ring.scale.setScalar(1)
        }
        const selected = current === h.region
        h.core.scale.setScalar(selected ? 1.5 : 1)
      }
    }
    // Scene is created once; later changes go through itemsRef / selectedRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the 3D hotspots in sync with the indication statuses and selection.
  useEffect(() => {
    itemsRef.current = items
    applyHotspotStateRef.current()
  }, [items, selectedRegion])

  // Highlight organ meshes by status and dim regions that are not selected.
  useEffect(() => {
    for (const { mesh, region } of meshesRef.current) {
      const status = regionStatus(items, region)
      const dimmed = selectedRegion !== 'ALL' && selectedRegion !== region
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of materials) {
        if (m instanceof THREE.MeshStandardMaterial) {
          m.emissive.setHex(STATUS_EMISSIVE[status])
          m.transparent = dimmed
          m.opacity = dimmed ? 0.25 : 1
        }
      }
    }
  }, [items, selectedRegion])

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-1">
      <div ref={containerRef} className="min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-night" />
    </div>
  )
}
