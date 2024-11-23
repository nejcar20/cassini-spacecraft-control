import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as satellite from "satellite.js";

interface ThreeEarthProps {
  satellites: { name: string; tle1: string; tle2: string }[];
  satellitesOfInterest: string[];
  satellitesOfSecondaryInterest: string[];
  ofInterestColor: string;
  ofSecondaryInterestColor: string;
  triggerZoom: boolean;
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

const ThreeEarth: React.FC<ThreeEarthProps> = ({
  satellites,
  satellitesOfInterest,
  satellitesOfSecondaryInterest,
  ofInterestColor = "#ff0000",
  ofSecondaryInterestColor = "#ffa500",
  triggerZoom = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sliderValueRef = useRef(50);
  const showNightLights = false;
  const [simulationTime, setSimulationTime] = useState(new Date());

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

    // Satellite Instanced Meshes
    const satelliteMeshes = {
      interest: new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshBasicMaterial({ color: ofInterestColor }),
        satellitesOfInterest.length
      ),
      secondaryInterest: new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshBasicMaterial({ color: ofSecondaryInterestColor }),
        satellitesOfSecondaryInterest.length
      ),
      others: new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x0000ff }),
        satellites.length -
          satellitesOfInterest.length -
          satellitesOfSecondaryInterest.length
      ),
    };

    Object.values(satelliteMeshes).forEach((mesh) => scene.add(mesh));

    // Function to calculate an orbit
    const calculateOrbit = (satelliteData: {
      name: string;
      tle1: string;
      tle2: string;
    }): THREE.Line => {
      const satrec = satellite.twoline2satrec(
        satelliteData.tle1,
        satelliteData.tle2
      );
      const points: THREE.Vector3[] = [];

      const timeForAFullOrbit = (2.0 * Math.PI) / satrec.no; // Approximate orbital period
      for (let i = 0; i < timeForAFullOrbit * 60; i += 60) {
        const time = new Date(simulationTime.getTime() + i * 1000);
        const positionAndVelocity = satellite.propagate(satrec, time);

        if (
          positionAndVelocity.position &&
          typeof positionAndVelocity.position !== "boolean"
        ) {
          const positionEci = positionAndVelocity.position;

          const scale = 10 / 6371; // Earth radius in km
          const x = positionEci.x * scale;
          const y = positionEci.y * scale;
          const z = positionEci.z * scale;

          points.push(new THREE.Vector3(x, y, z));
        }
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: satellitesOfInterest.includes(satelliteData.name)
          ? ofInterestColor
          : ofSecondaryInterestColor,
      });
      return new THREE.Line(geometry, material);
    };

    // Add orbits for satellites of interest and secondary interest
    satellites.forEach((satelliteData) => {
      if (
        satellitesOfInterest.includes(satelliteData.name) ||
        satellitesOfSecondaryInterest.includes(satelliteData.name)
      ) {
        const orbit = calculateOrbit(satelliteData);
        scene.add(orbit);
      }
    });

    // Update satellite positions
    const updateSatellitePositions = (time: Date) => {
      const matrices: any = {
        interest: [],
        secondaryInterest: [],
        others: [],
      };

      satellites.forEach((satelliteData) => {
        const satrec = satellite.twoline2satrec(
          satelliteData.tle1,
          satelliteData.tle2
        );
        const positionAndVelocity = satellite.propagate(satrec, time);

        if (
          positionAndVelocity.position &&
          typeof positionAndVelocity.position !== "boolean"
        ) {
          const { x, y, z } = positionAndVelocity.position;
          const scale = 10 / 6371;
          const matrix = new THREE.Matrix4().setPosition(
            x * scale,
            y * scale,
            z * scale
          );

          if (satellitesOfInterest.includes(satelliteData.name)) {
            matrices.interest.push(matrix);
          } else if (
            satellitesOfSecondaryInterest.includes(satelliteData.name)
          ) {
            matrices.secondaryInterest.push(matrix);
          } else {
            matrices.others.push(matrix);
          }
        }
      });

      ["interest", "secondaryInterest", "others"].forEach((key) => {
        const mesh = (satelliteMeshes as any)[key];
        matrices[key].forEach((matrix: any, index: number) => {
          mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      });
    };

    // Animation loop
    let simulationTimeVar = new Date(simulationTime);
    const animate = () => {
      const timeIncrement = (sliderValueRef.current * 1000) / 60;
      simulationTimeVar = new Date(simulationTimeVar.getTime() + timeIncrement);

      setSimulationTime(simulationTimeVar);
      updateSatellitePositions(simulationTimeVar);

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      renderer.dispose();
      scene.clear();
      renderer.domElement.remove();
    };
  }, [satellites, satellitesOfInterest, satellitesOfSecondaryInterest]);

  const animateZoomToSatellites = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const valueOfRef = sliderValueRef.current;
    sliderValueRef.current = 10;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    // Find the average position of satellitesOfInterest
    const positions = satellites
      .filter((sat) => satellitesOfInterest.includes(sat.name))
      .map((sat) => {
        const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
        const positionAndVelocity = satellite.propagate(satrec, simulationTime);

        if (
          positionAndVelocity.position &&
          typeof positionAndVelocity.position !== "boolean"
        ) {
          const { x, y, z } = positionAndVelocity.position;
          const scale = 10 / 6371;

          return new THREE.Vector3(x * scale, y * scale, z * scale);
        }
        return null;
      })
      .filter((pos): pos is THREE.Vector3 => pos !== null);

    if (positions.length === 0) return;
    // Calculate the average position
    const targetPosition = positions
      .reduce((acc, pos) => acc.add(pos), new THREE.Vector3())
      .divideScalar(positions.length); // Average position

    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection); // Normalized camera direction

    // Add an offset to zoom out slightly from the target
    const zoomOffset = 5; // Distance to pull back
    const adjustedTargetPosition = targetPosition
      .clone()
      .add(cameraDirection.multiplyScalar(-zoomOffset));

    const initialPosition = camera.position.clone();
    const zoomDuration = 1000; // Duration of zoom in ms
    const zoomOutDelay = 1500; // Wait before zooming out in ms

    // Animate camera to zoom in
    let elapsedTime = 0;
    const zoomInAnimation = () => {
      elapsedTime += 16; // Assuming ~60fps
      const t = elapsedTime / zoomDuration;
      if (t < 1) {
        camera.position.lerpVectors(initialPosition, adjustedTargetPosition, t);
        controls.target.lerp(adjustedTargetPosition, t);
        controls.update();
        requestAnimationFrame(zoomInAnimation);
      } else {
        // After zoom in, change orbits or apply effects
        sliderValueRef.current = valueOfRef;
        setTimeout(() => animateZoomOut(), zoomOutDelay);
      }
    };

    const animateZoomOut = () => {
      elapsedTime = 0;
      const zoomOutAnimation = () => {
        elapsedTime += 16;

        const t = elapsedTime / zoomDuration;
        if (t < 1) {
          camera.position.lerpVectors(targetPosition, initialPosition, t);
          controls.target.lerp(new THREE.Vector3(0, 0, 0), t); // Reset to Earth
          controls.update();
          requestAnimationFrame(zoomOutAnimation);
        }
      };

      zoomOutAnimation();
    };

    zoomInAnimation();
  };

  useEffect(() => {
    if (triggerZoom) {
      animateZoomToSatellites();
    }
  }, [triggerZoom]);
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
    </div>
  );
};

export default ThreeEarth;
