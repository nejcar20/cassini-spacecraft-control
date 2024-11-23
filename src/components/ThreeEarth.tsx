"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as satellite from "satellite.js";
import { SatelliteTLE } from "../utils/fetchSatellites";

interface ThreeEarthProps {
  satellites: SatelliteTLE[];
}

const ThreeEarth: React.FC<ThreeEarthProps> = ({ satellites }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showNightLights, setShowNightLights] = useState(false);
  const [selectedSatellite, setSelectedSatellite] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true); // Add loading state

  const run = () => {
    if (!containerRef.current) return;
    if (!satellites || satellites.length === 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current!.clientWidth / containerRef.current!.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    containerRef.current.appendChild(renderer.domElement);

    // Raycaster for interactivity
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 200);
    pointLight.position.set(30, 30, 30);
    scene.add(ambientLight, pointLight);

    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.position.set(20, 15, 20);
    controls.update();

    // Add Earth
    const earthGroup = new THREE.Group();
    const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: new THREE.TextureLoader().load("/assets/Albedo.jpg"),
      bumpMap: new THREE.TextureLoader().load("/assets/Bump.jpg"),
      bumpScale: 0.03,
      roughnessMap: new THREE.TextureLoader().load("/assets/Ocean.png"),
      metalnessMap: new THREE.TextureLoader().load("/assets/Ocean.png"),
      emissiveMap: showNightLights
        ? new THREE.TextureLoader().load("/assets/night_lights_modified.png")
        : null,
      emissive: showNightLights
        ? new THREE.Color(0xffff88)
        : new THREE.Color(0x000000),
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);

    earthGroup.add(earth);
    scene.add(earthGroup);

    const satelliteMeshes: THREE.Mesh[] = [];
    const satelliteTrajectories: THREE.Line[] = [];

    const addSatellites = async () => {
      satellites.forEach((satelliteData) => {
        const satrec = satellite.twoline2satrec(
          satelliteData.tle1,
          satelliteData.tle2
        );

        const satelliteGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const satelliteMaterial = new THREE.MeshBasicMaterial({
          color: 0xff0000,
        });
        const satelliteMesh = new THREE.Mesh(
          satelliteGeometry,
          satelliteMaterial
        );

        satelliteMesh.userData = { name: satelliteData.name, satrec };
        scene.add(satelliteMesh);
        satelliteMeshes.push(satelliteMesh);

        const points: THREE.Vector3[] = [];
        for (let i = 0; i < 5400; i += 60) {
          const time = new Date();
          time.setSeconds(time.getSeconds() + i);

          const positionAndVelocity = satellite.propagate(satrec, time);

          // Skip if propagation fails
          if (
            !positionAndVelocity ||
            positionAndVelocity.position === false ||
            positionAndVelocity.position === true
          ) {
            return;
          }

          const gmst = satellite.gstime(time);
          const geodetic = satellite.eciToGeodetic(
            positionAndVelocity.position,
            gmst
          );

          const latitude = (geodetic.latitude * 180) / Math.PI;
          const longitude = (geodetic.longitude * 180) / Math.PI;
          const altitude = geodetic.height / 6371;

          const x =
            (10 + altitude) *
            Math.cos((latitude * Math.PI) / 180) *
            Math.cos((longitude * Math.PI) / 180);
          const y = (10 + altitude) * Math.sin((latitude * Math.PI) / 180);
          const z =
            (10 + altitude) *
            Math.cos((latitude * Math.PI) / 180) *
            Math.sin((longitude * Math.PI) / 180);

          if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

          points.push(new THREE.Vector3(x, y, z));
        }

        if (points.length > 0) {
          const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(
            points
          );
          const trajectoryMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
          });
          const trajectoryLine = new THREE.Line(
            trajectoryGeometry,
            trajectoryMaterial
          );
          scene.add(trajectoryLine);
          satelliteTrajectories.push(trajectoryLine);
        }
      });
      setLoading(false); // Set loading state to false
    };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      satelliteMeshes.forEach((mesh) => {
        const { satrec } = mesh.userData;
        const now = new Date();
        const positionAndVelocity = satellite.propagate(satrec, now);

        const gmst = satellite.gstime(now);

        if (
          positionAndVelocity.position === true ||
          positionAndVelocity.position === false
        )
          return;

        const geodetic = satellite.eciToGeodetic(
          positionAndVelocity.position,
          gmst
        );

        const latitude = (geodetic.latitude * 180) / Math.PI;
        const longitude = (geodetic.longitude * 180) / Math.PI;
        const altitude = geodetic.height / 6371;

        const x =
          (10 + altitude) *
          Math.cos((latitude * Math.PI) / 180) *
          Math.cos((longitude * Math.PI) / 180);
        const y = (10 + altitude) * Math.sin((latitude * Math.PI) / 180);
        const z =
          (10 + altitude) *
          Math.cos((latitude * Math.PI) / 180) *
          Math.sin((longitude * Math.PI) / 180);

        mesh.position.set(x, y, z);
      });

      earth.rotateY(0.0005);
      controls.update();
      renderer.render(scene, camera);
    };
    console.log("EHEHEH");
    addSatellites();
    animate();
    return () => {
      renderer.dispose();
    };
  };

  useEffect(() => {
    run();
  }, []);

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
    </div>
  );
};

export default ThreeEarth;
