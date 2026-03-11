const GEO_INDEX_URL = 'https://directory.minyvinyl.com/geo-index.json';
const ENTITIES_URL = 'https://directory.minyvinyl.com/entities.json';

let geoCache = null;
let entitiesCache = null;

export async function fetchGeoIndex() {
	if (geoCache) return geoCache;
	try {
		const res = await fetch(GEO_INDEX_URL);
		if (!res.ok) return {};
		const data = await res.json();
		geoCache = data.entities || data;
		return geoCache;
	} catch {
		return {};
	}
}

export async function fetchEntities() {
	if (entitiesCache) return entitiesCache;
	try {
		const res = await fetch(ENTITIES_URL);
		if (!res.ok) return [];
		const data = await res.json();
		if (Array.isArray(data)) {
			entitiesCache = data;
		} else if (data && data.categories) {
			entitiesCache = Object.values(data.categories).flat();
		} else {
			entitiesCache = [];
		}
		return entitiesCache;
	} catch {
		return [];
	}
}

function haversineKm(lat1, lon1, lat2, lon2) {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function findNearby(lat, lon, radiusKm = 80, limit = 20) {
	const geo = await fetchGeoIndex();
	const results = [];

	for (const [id, entry] of Object.entries(geo)) {
		if (!entry.lat || !entry.lng) continue;
		const dist = haversineKm(lat, lon, entry.lat, entry.lng);
		if (dist <= radiusKm) {
			results.push({ ...entry, id, distance: dist });
		}
	}

	results.sort((a, b) => (b.mentionScore || 0) - (a.mentionScore || 0));
	return results.slice(0, limit);
}

export async function getEntityDetail(name) {
	const entities = await fetchEntities();
	return entities.find(e =>
		e.name && e.name.toLowerCase() === name.toLowerCase()
	) || null;
}

const CATEGORY_LABELS = {
	artists: 'Artist',
	bands: 'Band',
	venues: 'Venue',
	festivals: 'Festival',
	labels: 'Label',
	producers: 'Producer',
	music_orgs: 'Organization',
	media: 'Media',
};

export function categoryLabel(cat) {
	return CATEGORY_LABELS[cat] || cat;
}

export function entityLink(entity) {
	if (entity.generated_epk_url) return entity.generated_epk_url;
	if (entity.rapidconnect_id) {
		return `https://rapidconnect.minyvinyl.com/artists/${entity.rapidconnect_id}`;
	}
	const slug = (entity.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
	const cat = entity.category || 'artists';
	return `https://directory.minyvinyl.com/entity/${cat}-${slug}`;
}
