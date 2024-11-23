"use client";

import React, { useEffect, useState } from "react";
import ThreeScene from "../components/ThreeEarth";
import { fetchSatelliteTLEs, SatelliteTLE } from "../utils/fetchSatellites";

const Home = () => {
  const [satellites, setSatellites] = useState<
    { name: string; tle1: string; tle2: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSatellites = async () => {
      try {
        const data = await fetchSatelliteTLEs();

        setSatellites(data.slice(0, 100));
      } catch (error) {
        console.error("Error loading satellites:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSatellites();
  }, []);
  console.log(satellites);
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: "70%", height: "100%" }}>
        {loading && <p>Loading...</p>}
        {!loading && <ThreeScene satellites={satellites} />}
      </div>
      <div
        style={{
          width: "30%",
          height: "100%",
          padding: "1rem",
          background: "#f0f0f0",
          overflowY: "auto",
        }}
      >
        <h1>Satellite Tracker</h1>
        <p>Details will go here.</p>
      </div>
    </div>
  );
};

export default Home;
