import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as satellite from "satellite.js";
interface ThreeEarthProps {
  satellites: { name: string; tle1: string; tle2: string }[];
}

const ThreeEarth: React.FC<ThreeEarthProps> = ({ satellites }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showNightLights, setShowNightLights] = useState(false);
  const [simulationTime, setSimulationTime] = useState(new Date());
  const [selectedSatellite, setSelectedSatellite] = useState<{
    name: string;
    tle1: string;
    tle2: string;
  } | null>(null);
  const [orbitLine, setOrbitLine] = useState<THREE.Line | null>(null);

  useEffect(() => {
    if (!containerRef.current || satellites.length === 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    scene.add(ambientLight, directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(20, 15, 20);
    controls.update();

    const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: new THREE.TextureLoader().load("/assets/Albedo.jpg"),
      bumpMap: new THREE.TextureLoader().load("/assets/Bump.jpg"),
      bumpScale: 0.03,
      emissiveMap: showNightLights
        ? new THREE.TextureLoader().load("/assets/night_lights_modified.png")
        : null,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    const satelliteMeshes: THREE.InstancedMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      satellites.length
    );
    scene.add(satelliteMeshes);

    let currentOrbitLine: THREE.Line | null = null; // Track the orbit line

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

          // Remove old orbit line if it exists
          if (currentOrbitLine) {
            scene.remove(currentOrbitLine);
            currentOrbitLine.geometry.dispose();
            currentOrbitLine.material.dispose();
            currentOrbitLine = null;
          }

          // Add new orbit line
          const orbit = calculateOrbit(satellites[instanceId]);
          scene.add(orbit);
          currentOrbitLine = orbit;
        }
      }
    };

    const animate = () => {
      requestAnimationFrame(animate);
      satellites.forEach((satelliteData, index) => {
        const satrec = satellite.twoline2satrec(
          satelliteData.tle1,
          satelliteData.tle2
        );
        const positionAndVelocity = satellite.propagate(satrec, simulationTime);

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
    };

    animate();
    renderer.domElement.addEventListener("click", handleMouseClick);

    return () => {
      renderer.dispose();
      if (currentOrbitLine) {
        scene.remove(currentOrbitLine);
        currentOrbitLine.geometry.dispose();
      }
    };
  }, [showNightLights, simulationTime, satellites]);

  const calculateOrbit = (satelliteData: {
    tle1: string;
    tle2: string;
  }): THREE.Line => {
    const satrec = satellite.twoline2satrec(
      satelliteData.tle1,
      satelliteData.tle2
    );
    const points: THREE.Vector3[] = [];

    const timeForAFullOrbit = (2.0 * Math.PI) / satrec.no; // Time in minutes for a full orbit
    // Calculate positions over 90 minutes relative to simulationTime
    for (let i = 0; i < timeForAFullOrbit * 60; i += 60) {
      const time = new Date(simulationTime.getTime() + i * 1000); // Orbit times relative to simulationTime
      const positionAndVelocity = satellite.propagate(satrec, time);

      if (
        positionAndVelocity.position &&
        typeof positionAndVelocity.position !== "boolean"
      ) {
        const positionEci = positionAndVelocity.position;

        // Scale and transform ECI coordinates into the 3D space
        const scale = 10 / 6371; // Earth radius scaling factor
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
      <button
        onClick={() => setShowNightLights(!showNightLights)}
        style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Toggle Night Lights
      </button>
      <input
        type="range"
        min="1"
        max="100"
        defaultValue="1"
        onChange={(e) =>
          setSimulationTime(
            new Date(new Date().getTime() + parseInt(e.target.value) * 60000)
          )
        }
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
