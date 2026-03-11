import L from 'leaflet';
import { state, updateState } from '../core/state.js';
import { entityIcons, entityColors } from '../core/entity-icons.js';
import { getMap, getArtisticMap } from './map-init.js';

let leafletMarkers = [];
let artisticMarkers = [];

const svgParser = new DOMParser();

function parseSvg(svgString) {
	const doc = svgParser.parseFromString(svgString, 'image/svg+xml');
	return doc.documentElement;
}

export function clearEntityMarkers() {
	leafletMarkers.forEach(m => m.remove());
	artisticMarkers.forEach(m => m.remove());
	leafletMarkers = [];
	artisticMarkers = [];
}

export function addEntityMarker(entity) {
	const existing = state.entityMarkers.find(m => m.id === entity.id);
	if (existing) {
		updateState({
			entityMarkers: state.entityMarkers.filter(m => m.id !== entity.id)
		});
	} else {
		updateState({
			entityMarkers: [...state.entityMarkers, {
				id: entity.id,
				name: entity.name,
				category: entity.category,
				lat: entity.lat,
				lon: entity.lng || entity.lon,
			}]
		});
	}
}

export function isEntityPinned(entityId) {
	return state.entityMarkers.some(m => m.id === entityId);
}

function createMarkerElement(category, size) {
	const color = entityColors[category] || '#475569';
	const iconSvg = entityIcons[category] || entityIcons.artists;

	const wrapper = document.createElement('div');
	wrapper.style.cssText = `width:${size}px;height:${size}px;color:${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));`;

	const svg = parseSvg(iconSvg);
	svg.setAttribute('width', String(size));
	svg.setAttribute('height', String(size));
	wrapper.appendChild(svg);

	return wrapper;
}

export function updateEntityMarkers(currentState) {
	const map = getMap();
	const artisticMap = getArtisticMap();
	if (!map) return;

	clearEntityMarkers();

	if (!currentState.showEntityMarkers) return;
	const entities = currentState.entityMarkers || [];
	if (!entities.length) return;

	const size = 28;

	entities.forEach((em, index) => {
		const el = createMarkerElement(em.category, size);

		const icon = L.divIcon({
			className: 'entity-marker',
			html: el.outerHTML,
			iconSize: [size, size],
			iconAnchor: [size / 2, size / 2],
		});

		const marker = L.marker([em.lat, em.lon], { icon, draggable: true }).addTo(map);

		marker.on('dragend', () => {
			const pos = marker.getLatLng();
			const updated = [...currentState.entityMarkers];
			updated[index] = { ...updated[index], lat: pos.lat, lon: pos.lng };
			updateState({ entityMarkers: updated });
		});

		leafletMarkers.push(marker);

		if (artisticMap) {
			import('maplibre-gl').then(mod => {
				const mgl = mod.default || mod;
				const aEl = createMarkerElement(em.category, size);

				const aMarker = new mgl.Marker({ element: aEl, anchor: 'center', draggable: true })
					.setLngLat([em.lon, em.lat])
					.addTo(artisticMap);

				aMarker.on('dragend', () => {
					const pos = aMarker.getLngLat();
					const updated = [...currentState.entityMarkers];
					updated[index] = { ...updated[index], lat: pos.lat, lon: pos.lng };
					updateState({ entityMarkers: updated });
				});

				artisticMarkers.push(aMarker);
			});
		}
	});

	updateLegend(currentState);
}

function updateLegend(currentState) {
	const container = document.getElementById('poster-container');
	if (!container) return;

	let legend = document.getElementById('entity-legend');
	const entities = currentState.entityMarkers || [];

	if (!entities.length || !currentState.showEntityMarkers) {
		if (legend) legend.remove();
		return;
	}

	if (!legend) {
		legend = document.createElement('div');
		legend.id = 'entity-legend';
		container.appendChild(legend);
	}

	legend.className = 'absolute bottom-3 left-3 z-20 pointer-events-none';
	legend.style.cssText = '';
	legend.textContent = '';

	const inner = document.createElement('div');
	inner.style.cssText = 'background:rgba(255,255,255,0.88);backdrop-filter:blur(8px);border-radius:8px;padding:6px 8px;max-width:180px;';

	const title = document.createElement('div');
	title.style.cssText = 'font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:4px;';
	title.textContent = 'MINY Directory';
	inner.appendChild(title);

	entities.slice(0, 8).forEach((em) => {
		const row = document.createElement('div');
		row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:2px;';

		const dot = document.createElement('div');
		const color = entityColors[em.category] || '#475569';
		dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;`;
		row.appendChild(dot);

		const name = document.createElement('span');
		name.style.cssText = 'font-size:7px;font-weight:600;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;display:block;';
		name.textContent = em.name;
		row.appendChild(name);

		const cat = document.createElement('span');
		cat.style.cssText = `font-size:5px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0;`;
		cat.textContent = em.category === 'music_orgs' ? 'ORG' : em.category.slice(0, 3).toUpperCase();
		row.appendChild(cat);

		inner.appendChild(row);
	});

	if (entities.length > 8) {
		const more = document.createElement('div');
		more.style.cssText = 'font-size:6px;color:#94a3b8;margin-top:2px;';
		more.textContent = `+${entities.length - 8} more`;
		inner.appendChild(more);
	}

	legend.appendChild(inner);
}
