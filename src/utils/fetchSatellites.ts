import { getCachedData, setCachedData, isCacheValid } from "./cacheUtils";

export interface SatelliteTLE {
  name: string;
  tle1: string;
  tle2: string;
}

const SATELLITE_CACHE_KEY = "satelliteData";

export const fetchSatelliteTLEs = async (): Promise<SatelliteTLE[]> => {
  // Check if cached data is valid
  if (isCacheValid(SATELLITE_CACHE_KEY)) {
    console.log("Using cached satellite data.");
    return getCachedData(SATELLITE_CACHE_KEY).data;
  }

  // Fetch fresh data
  try {
    const response = await fetch(
      "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text();

    const lines = data.split("\n").filter((line) => line.trim().length > 0);
    const satellites: SatelliteTLE[] = [];

    for (let i = 0; i < lines.length; i += 3) {
      if (lines[i + 1] && lines[i + 2]) {
        satellites.push({
          name: lines[i].trim(),
          tle1: lines[i + 1].trim(),
          tle2: lines[i + 2].trim(),
        });
      }
    }

    // Cache the data for 1 hour
    setCachedData(SATELLITE_CACHE_KEY, satellites, 60);
    console.log("Satellite data cached.");

    return satellites;
  } catch (error) {
    console.error("Failed to fetch satellite data:", error);
    // Fall back to cached data if available
    const cachedData = getCachedData(SATELLITE_CACHE_KEY);
    if (cachedData) {
      console.warn("Using stale cached satellite data.");
      return cachedData.data;
    }
    throw new Error("Satellite data unavailable.");
  }
};
