import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as satellite from "satellite.js";

interface ThreeEarthProps {
  satellites: { name: string; tle1: string; tle2: string }[];
}

const createScene = (container: HTMLDivElement) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set(20, 15, 20);
  controls.update();

  return { scene, camera, renderer, controls };
};

const createEarth = (showNightLights: boolean): THREE.Mesh => {
  const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
  const earthMaterial = new THREE.MeshStandardMaterial({
    map: new THREE.TextureLoader().load("/assets/Albedo.jpg"),
    bumpMap: new THREE.TextureLoader().load("/assets/Bump.jpg"),
    bumpScale: 0.03,
    emissiveMap: showNightLights
      ? new THREE.TextureLoader().load("/assets/night_lights_modified.png")
      : null,
  });
  return new THREE.Mesh(earthGeometry, earthMaterial);
};

const ThreeEarth: React.FC<ThreeEarthProps> = ({ satellites }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const sliderValueRef = useRef(1);
  const showNightLights = false;
  const [simulationTime, setSimulationTime] = useState(new Date());
  const [selectedSatellite, setSelectedSatellite] = useState<{
    name: string;
    tle1: string;
    tle2: string;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current || satellites.length === 0) return;

    const { scene, camera, renderer, controls } = createScene(
      containerRef.current
    );

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    scene.add(ambientLight, directionalLight);

    const earth = createEarth(showNightLights);
    scene.add(earth);

    const satelliteMeshes: THREE.InstancedMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      satellites.length
    );
    scene.add(satelliteMeshes);

    let currentOrbitLine: THREE.Line | null = null;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObject(satelliteMeshes, true);
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          setSelectedSatellite(satellites[instanceId]);

          if (currentOrbitLine) {
            scene.remove(currentOrbitLine);
            currentOrbitLine.geometry.dispose();
            currentOrbitLine = null;
          }

          const orbit = calculateOrbit(satellites[instanceId]);
          scene.add(orbit);
          currentOrbitLine = orbit;
        }
      }
    };

    let simulationTimeVar = new Date(simulationTime);

    const animate = () => {
      const timeIncrement = (sliderValueRef.current * 1000) / 60;
      simulationTimeVar = new Date(simulationTimeVar.getTime() + timeIncrement);

      setSimulationTime(new Date(simulationTimeVar));

      satellites.forEach((satelliteData, index) => {
        const satrec = satellite.twoline2satrec(
          satelliteData.tle1,
          satelliteData.tle2
        );
        const positionAndVelocity = satellite.propagate(
          satrec,
          simulationTimeVar
        );
        if (
          positionAndVelocity.position &&
          typeof positionAndVelocity.position !== "boolean"
        ) {
          const positionEci = positionAndVelocity.position;

          const scale = 10 / 6371;
          const x = positionEci.x * scale;
          const y = positionEci.y * scale;
          const z = positionEci.z * scale;

          const matrix = new THREE.Matrix4().setPosition(x, y, z);
          satelliteMeshes.setMatrixAt(index, matrix);
        }
      });
      satelliteMeshes.instanceMatrix.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);

      requestAnimationFrame(animate);
    };

    animate();
    renderer.domElement.addEventListener("click", handleMouseClick);

    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      earthRef.current = null;
      renderer.domElement.removeEventListener("click", handleMouseClick);
      //remove the canvas
      renderer.domElement.remove();
      if (currentOrbitLine) {
        scene.remove(currentOrbitLine);
        currentOrbitLine.geometry.dispose();
      }
    };
  }, []);

  const calculateOrbit = (satelliteData: {
    tle1: string;
    tle2: string;
  }): THREE.Line => {
    const satrec = satellite.twoline2satrec(
      satelliteData.tle1,
      satelliteData.tle2
    );
    const points: THREE.Vector3[] = [];

    const timeForAFullOrbit = (2.0 * Math.PI) / satrec.no;
    for (let i = 0; i < timeForAFullOrbit * 60; i += 60) {
      const time = new Date(simulationTime.getTime() + i * 1000);
      const positionAndVelocity = satellite.propagate(satrec, time);

      if (
        positionAndVelocity.position &&
        typeof positionAndVelocity.position !== "boolean"
      ) {
        const positionEci = positionAndVelocity.position;

        const scale = 10 / 6371;
        const x = positionEci.x * scale;
        const y = positionEci.y * scale;
        const z = positionEci.z * scale;

        points.push(new THREE.Vector3(x, y, z));
      }
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    return new THREE.Line(geometry, material);
  };

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <input
        type="range"
        min="1"
        max="500"
        defaultValue={sliderValueRef.current}
        onChange={(e) => {
          sliderValueRef.current = parseInt(e.target.value, 10);
        }}
        style={{
          position: "absolute",
          bottom: "20px",
          left: "150px",
          width: "300px",
        }}
      />
      {selectedSatellite && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            backgroundColor: "white",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          <h3>Satellite Details</h3>
          <p>
            <strong>Name:</strong> {selectedSatellite.name}
          </p>
          <p>
            <strong>TLE 1:</strong> {selectedSatellite.tle1}
          </p>
          <p>
            <strong>TLE 2:</strong> {selectedSatellite.tle2}
          </p>
        </div>
      )}
    </div>
  );
};

export default ThreeEarth;
