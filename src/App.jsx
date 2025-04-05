import React, { useRef, useState, useEffect, useMemo } from "react"
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"

const HeightmapCanvas = ({ onUpdate }) => {
  const canvasRef = useRef()

  const createHeightMap = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, 256, 256)

    for (let i = 0; i < 100; i++) {
      const x = Math.floor(Math.random() * 255)
      const y = Math.floor(Math.random() * 255)
      const radius = 50
      const grd = ctx.createRadialGradient(x, y, 1, x, y, radius)
      const h8 = Math.floor(Math.random() * 255)
      grd.addColorStop(0, `rgb(${h8}, ${h8}, ${h8})`)
      grd.addColorStop(1, "transparent")
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, 256, 256)
    }

    onUpdate(canvas)
  }

  useEffect(() => {
    createHeightMap()
    const interval = setInterval(createHeightMap, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={256}
      style={{
        position: "absolute",
        border: "1px solid aqua",
        margin: "10px",
      }}
    />
  )
}

const HeightmapInstances = ({ planeGeometry, heightMap }) => {
  const instancedMeshRef = useRef()
  const MAX_COUNT = planeGeometry.attributes.position.count

  const colorUniform = useRef({
    heightMap: { value: heightMap },
  })

  useEffect(() => {
    colorUniform.current.heightMap.value = heightMap
  }, [heightMap])

  // Create box geometry with instUV attribute
  const boxGeometry = useMemo(() => {
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
    geometry.setAttribute(
      "instUV",
      new THREE.InstancedBufferAttribute(planeGeometry.attributes.uv.array, 2)
    )
    return geometry
  }, [planeGeometry])

  // Set up instance matrices
  useEffect(() => {
    if (!instancedMeshRef.current) return

    const dummy = new THREE.Object3D()
    const v3 = new THREE.Vector3()

    for (let i = 0; i < MAX_COUNT; i++) {
      dummy.position.fromBufferAttribute(planeGeometry.attributes.position, i)
      dummy.rotation.setFromVector3(v3.random().multiplyScalar(Math.PI))
      dummy.updateMatrix()
      instancedMeshRef.current.setMatrixAt(i, dummy.matrix)
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true
  }, [planeGeometry, MAX_COUNT])

  // Custom shader material
  const customMaterial = useMemo(() => {
    return new THREE.MeshLambertMaterial({
      onBeforeCompile: (shader) => {
        shader.uniforms.heightMap = colorUniform.current.heightMap
        shader.vertexShader = `
          uniform sampler2D heightMap;
          attribute vec2 instUV;
          varying float vHeight;
          ${shader.vertexShader}
        `.replace(
          `#include <project_vertex>`,
          `
          vec4 mvPosition = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            mat4 imat = instanceMatrix;
            float h = texture2D(heightMap, instUV).r;
            vHeight = h;
            imat[3].y += h * 5.;
            mvPosition = imat * mvPosition;
          #endif
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;
          `
        )

        shader.fragmentShader = `
          varying float vHeight;
          ${shader.fragmentShader}
        `.replace(
          `vec4 diffuseColor = vec4( diffuse, opacity );`,
          `
          vec3 col = mix(vec3(1, 0.125, 0), vec3(0, 1, 1), vHeight);
          vec4 diffuseColor = vec4( col, opacity );`
        )
      },
    })
  }, [])

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[boxGeometry, customMaterial, MAX_COUNT]}
    />
  )
}

const Scene = () => {
  const [heightMap, setHeightMap] = useState(null)

  // Handle canvas update
  const handleCanvasUpdate = (canvas) => {
    if (!canvas) return
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    setHeightMap(texture)
  }

  // Create plane geometry
  const planeGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(20, 20, 100, 100)
    geometry.rotateX(Math.PI * -0.5)
    return geometry
  }, [])

  return (
    <>
      <HeightmapCanvas onUpdate={handleCanvasUpdate} />
      <Canvas
        camera={{ position: [0, 5, 10], fov: 60 }}
        style={{ width: "100vw", height: "100vh" }}
      >
        <OrbitControls enableDamping />
        <hemisphereLight args={[0xffffff, 0x7f7f7f]} />
        {heightMap && (
          <HeightmapInstances
            planeGeometry={planeGeometry}
            heightMap={heightMap}
          />
        )}
      </Canvas>
    </>
  )
}

export default function App() {
  return <Scene />
}
