import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface ThreeSceneProps {
  onSceneReady: (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer
  ) => void;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({ onSceneReady }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Scene
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

    // Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    scene.add(ambientLight, directionalLight);

    // Add Camera Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(20, 15, 20);
    controls.update();

    // Pass scene, camera, and renderer to parent via callback
    onSceneReady(scene, camera, renderer);

    // Cleanup on component unmount
    return () => {
      renderer.dispose();
    };
  }, [onSceneReady]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
};

export default ThreeScene;
