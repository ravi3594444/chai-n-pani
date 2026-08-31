type ReverseGeocodeRequest = {
  latitude?: string;
  longitude?: string;
};

type NominatimResult = {
  display_name?: string;
};

type CachedAddress = {
  address: string;
  expiresAt: number;
};

const addressCache = new Map<string, CachedAddress>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_LOOKUP_INTERVAL_MS = 1000;
let lastLookupAt = 0;
let lookupQueue: Promise<void> = Promise.resolve();

const json = (body: object, status = 200) => Response.json(body, {
  status,
  headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

const lookupAddress = async (latitude: string, longitude: string) => {
  let releaseQueue = () => {};
  const previousLookup = lookupQueue;
  lookupQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });

  await previousLookup;
  try {
    const waitMs = Math.max(0, MIN_LOOKUP_INTERVAL_MS - (Date.now() - lastLookupAt));
    if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    lastLookupAt = Date.now();

    const query = new URLSearchParams({
      format: "jsonv2",
      lat: latitude,
      lon: longitude,
      zoom: "18",
      addressdetails: "1",
      layer: "address",
      "accept-language": "en",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ChaiNPaniOrdering/1.0 (https://tableqr-menu-rebuild.belugaremodeling.chatgpt.site)",
      },
    });
    if (!response.ok) throw new Error("Nominatim lookup failed");

    const result = await response.json() as NominatimResult;
    const address = result.display_name?.trim() || "";
    if (!address) throw new Error("No address returned");
    return address;
  } finally {
    releaseQueue();
  }
};

export async function POST(request: Request) {
  let payload: ReverseGeocodeRequest;
  try {
    payload = await request.json() as ReverseGeocodeRequest;
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const latitudeNumber = Number(payload.latitude);
  const longitudeNumber = Number(payload.longitude);
  if (!Number.isFinite(latitudeNumber) || !Number.isFinite(longitudeNumber)
    || latitudeNumber < -90 || latitudeNumber > 90
    || longitudeNumber < -180 || longitudeNumber > 180) {
    return json({ error: "Invalid coordinates" }, 400);
  }

  const latitude = latitudeNumber.toFixed(6);
  const longitude = longitudeNumber.toFixed(6);
  const cacheKey = `${latitude},${longitude}`;
  const cached = addressCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return json({ displayName: cached.address });
  }

  try {
    const address = await lookupAddress(latitude, longitude);
    addressCache.set(cacheKey, { address, expiresAt: Date.now() + CACHE_TTL_MS });
    return json({ displayName: address });
  } catch {
    return json({ error: "Readable address unavailable" }, 502);
  }
}
