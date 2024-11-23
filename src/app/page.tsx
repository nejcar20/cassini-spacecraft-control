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
        const collidableSatellites = [
          {
            name: "Satellite 1",
            tle1: "1 00001U 20000A   24001.00000000  .00000000  00000-0  00000-0 0  9999",
            tle2: "2 00001  10.0000  10.0000 0001000  90.0000 270.0000 15.00000000    00",
          },
          {
            name: "Satellite 2",
            tle1: "1 00002U 20000B   24001.00000000  .00000000  00000-0  00000-0 0  9999",
            tle2: "2 00002  10.0000 190.0000 0001000 270.0000  90.0000 15.00000000    01",
          },
        ];
        const newSatellites = data.slice(0, 1).concat(collidableSatellites);
        setSatellites(newSatellites);
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
