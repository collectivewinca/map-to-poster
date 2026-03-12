import L from 'leaflet';
import { state, updateState, getSelectedTheme, getSelectedArtisticTheme } from '../core/state.js';
import { entityIcons, entityColors } from '../core/entity-icons.js';
import { hexToRgba } from '../core/utils.js';
import { getMap, getArtisticMap } from './map-init.js';

let leafletMarkers = [];
let artisticMarkers = [];

const svgParser = new DOMParser();
const CATEGORY_ORDER = ['artists', 'bands', 'venues', 'festivals', 'labels', 'producers', 'music_orgs', 'media'];
const CATEGORY_LABELS = {
	artists: 'Artists',
	bands: 'Bands',
	venues: 'Venues',
	festivals: 'Festivals',
	labels: 'Labels',
	producers: 'Producers',
	music_orgs: 'Music Orgs',
	media: 'Media'
};

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

function createMarkerWithLabel(entity, currentState, size) {
	const color = entityColors[entity.category] || '#475569';
	const isArtistic = currentState.renderMode === 'artistic';
	const activeTheme = isArtistic ? getSelectedArtisticTheme() : getSelectedTheme();
	const text = activeTheme.text || activeTheme.textColor || '#0f172a';
	const background = activeTheme.bg || activeTheme.background || '#ffffff';
	const wrapper = document.createElement('div');
	wrapper.dataset.entityMarker = entity.id || entity.name || '';

	wrapper.style.cssText = [
		'display:flex',
		'align-items:center',
		`gap:${Math.max(4, size * 0.18)}px`,
		'pointer-events:none'
	].join(';');

	const iconEl = createMarkerElement(entity.category, size);
	iconEl.style.flex = '0 0 auto';
	wrapper.appendChild(iconEl);

	if (entity.name) {
		const label = document.createElement('div');
		label.dataset.entityLabel = entity.id || entity.name || '';
		label.textContent = entity.name;
		label.style.cssText = [
			`max-width:${Math.max(96, size * 4.8)}px`,
			`padding:${Math.max(2, size * 0.1)}px ${Math.max(6, size * 0.22)}px`,
			`border-radius:${999}px`,
			`background:${isArtistic ? hexToRgba(background, 0.72) : hexToRgba('#ffffff', 0.86)}`,
			`border:1px solid ${hexToRgba(text, isArtistic ? 0.18 : 0.12)}`,
			`box-shadow:${isArtistic ? '0 8px 20px rgba(2, 6, 23, 0.24)' : '0 4px 14px rgba(15, 23, 42, 0.1)'}`,
			`color:${text}`,
			`font-size:${Math.max(9, size * 0.34)}px`,
			'font-weight:700',
			'line-height:1.2',
			'letter-spacing:0.02em',
			'white-space:nowrap',
			'overflow:hidden',
			'text-overflow:ellipsis',
			'backdrop-filter:blur(8px)',
			'-webkit-backdrop-filter:blur(8px)',
			'pointer-events:none'
		].join(';');
		wrapper.appendChild(label);
	}

	return wrapper;
}

function rectsOverlap(a, b, padding = 6) {
	return !(
		a.right + padding < b.left ||
		a.left - padding > b.right ||
		a.bottom + padding < b.top ||
		a.top - padding > b.bottom
	);
}

function applyEntityLabelCollisions() {
	const labels = Array.from(document.querySelectorAll('[data-entity-label]'));
	if (!labels.length) return;

	labels.forEach((label) => {
		label.style.opacity = '1';
		label.style.visibility = 'visible';
	});

	const occupied = [];
	labels
		.sort((a, b) => {
			const ra = a.getBoundingClientRect();
			const rb = b.getBoundingClientRect();
			if (Math.abs(ra.top - rb.top) > 1) return ra.top - rb.top;
			return ra.left - rb.left;
		})
		.forEach((label) => {
			const rect = label.getBoundingClientRect();
			if (!rect.width || !rect.height) return;

			const overlaps = occupied.some((existing) => rectsOverlap(rect, existing));
			if (overlaps) {
				label.style.opacity = '0';
				label.style.visibility = 'hidden';
				return;
			}

			occupied.push(rect);
		});
}

function scheduleEntityLabelCollisions() {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			applyEntityLabelCollisions();
		});
	});
}

function createLegendIcon(category, size, tint) {
	const iconWrap = document.createElement('div');
	iconWrap.style.cssText = `width:${size}px;height:${size}px;color:${tint};display:flex;align-items:center;justify-content:center;flex:0 0 auto;`;
	const svg = parseSvg(entityIcons[category] || entityIcons.artists);
	svg.setAttribute('width', String(size));
	svg.setAttribute('height', String(size));
	iconWrap.appendChild(svg);
	return iconWrap;
}

function getLegendPalette(currentState) {
	const isArtistic = currentState.renderMode === 'artistic';
	const activeTheme = isArtistic ? getSelectedArtisticTheme() : getSelectedTheme();
	const background = activeTheme.bg || activeTheme.background || '#ffffff';
	const text = activeTheme.text || activeTheme.textColor || '#0f172a';
	const panelBg = isArtistic
		? hexToRgba(background, 0.84)
		: (activeTheme.overlayBg || hexToRgba(background, 0.88));

	return {
		text,
		mutedText: hexToRgba(text, isArtistic ? 0.72 : 0.62),
		panelBg,
		panelEdge: hexToRgba(text, isArtistic ? 0.18 : 0.12),
		panelInset: hexToRgba(text, isArtistic ? 0.08 : 0.05),
		hairline: hexToRgba(text, isArtistic ? 0.14 : 0.1),
		shadow: isArtistic
			? '0 22px 60px rgba(2, 6, 23, 0.34)'
			: '0 18px 45px rgba(15, 23, 42, 0.16)'
	};
}

function buildLegendGroups(entities) {
	const grouped = new Map();
	entities.forEach((entity) => {
		const category = entity.category || 'artists';
		if (!grouped.has(category)) {
			grouped.set(category, { category, count: 0, names: [] });
		}
		const entry = grouped.get(category);
		entry.count += 1;
		if (entity.name) entry.names.push(entity.name);
	});

	return Array.from(grouped.values())
		.sort((a, b) => {
			const orderA = CATEGORY_ORDER.indexOf(a.category);
			const orderB = CATEGORY_ORDER.indexOf(b.category);
			if (orderA !== -1 || orderB !== -1) return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
			return a.category.localeCompare(b.category);
		});
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
		const el = createMarkerWithLabel(em, currentState, size);

		const icon = L.divIcon({
			className: 'entity-marker',
			html: el.outerHTML,
			iconSize: [Math.max(128, size * 5), Math.max(32, size * 1.5)],
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
				const aEl = createMarkerWithLabel(em, currentState, size);

				const aMarker = new mgl.Marker({ element: aEl, anchor: 'left', draggable: true, offset: [size / 2, 0] })
					.setLngLat([em.lon, em.lat])
					.addTo(artisticMap);

				aMarker.on('dragend', () => {
					const pos = aMarker.getLngLat();
					const updated = [...currentState.entityMarkers];
					updated[index] = { ...updated[index], lat: pos.lat, lon: pos.lng };
					updateState({ entityMarkers: updated });
				});

				artisticMarkers.push(aMarker);
				scheduleEntityLabelCollisions();
			});
		}
	});

	updateLegend(currentState);
	scheduleEntityLabelCollisions();
}

export function updateEntityLegend(currentState) {
	updateLegend(currentState);
}

function updateLegend(currentState) {
	const container = document.getElementById('poster-container');
	if (!container) return;

	let legend = document.getElementById('entity-legend');
	const entities = currentState.entityMarkers || [];

	if (!entities.length || !currentState.showEntityMarkers || currentState.showEntityLegend === false) {
		if (legend) legend.remove();
		return;
	}

	if (!legend) {
		legend = document.createElement('div');
		legend.id = 'entity-legend';
		container.appendChild(legend);
	}

	const s = currentState.entityLegendScale || 1;
	const palette = getLegendPalette(currentState);
	const groups = buildLegendGroups(entities);
	const matOffset = currentState.matEnabled ? (currentState.matWidth || 0) : 0;

	legend.className = 'absolute z-20 pointer-events-none';
	legend.style.cssText = '';
	legend.textContent = '';
	legend.style.left = `${matOffset + (20 * s)}px`;
	legend.style.bottom = `${matOffset + (20 * s)}px`;
	legend.style.maxWidth = `${Math.min(340 * s, container.clientWidth * 0.42)}px`;

	const inner = document.createElement('div');
	inner.style.cssText = [
		`background:${palette.panelBg}`,
		`backdrop-filter:blur(${10 * s}px) saturate(125%)`,
		`-webkit-backdrop-filter:blur(${10 * s}px) saturate(125%)`,
		`border-radius:${14 * s}px`,
		`padding:${11 * s}px ${12 * s}px ${10 * s}px`,
		`border:1px solid ${palette.panelEdge}`,
		`box-shadow:${currentState.renderMode === 'artistic' ? '0 14px 38px rgba(2, 6, 23, 0.22)' : '0 12px 28px rgba(15, 23, 42, 0.1)'}, inset 0 1px 0 ${palette.panelInset}`,
		`min-width:${160 * s}px`,
		`max-width:${320 * s}px`
	].join(';');

	const grid = document.createElement('div');
	grid.style.cssText = `display:grid;grid-template-columns:1fr;gap:${6 * s}px;`;

	groups.forEach((group) => {
		const color = entityColors[group.category] || palette.text;
		const card = document.createElement('div');
		card.style.cssText = [
			`display:flex`,
			`align-items:flex-start`,
			`gap:${7 * s}px`,
			`padding:${6 * s}px 0 ${6 * s}px`,
			`border-top:${grid.childElementCount ? `1px solid ${palette.hairline}` : 'none'}`
		].join(';');

		const iconChip = document.createElement('div');
		iconChip.style.cssText = [
			`width:${22 * s}px`,
			`height:${22 * s}px`,
			`border-radius:${999 * s}px`,
			`background:${hexToRgba(color, currentState.renderMode === 'artistic' ? 0.16 : 0.08)}`,
			'display:flex',
			'align-items:center',
			'justify-content:center',
			'flex:0 0 auto'
		].join(';');
		iconChip.appendChild(createLegendIcon(group.category, 13 * s, color));
		card.appendChild(iconChip);

		const body = document.createElement('div');
		body.style.cssText = 'min-width:0;flex:1;';

		const row = document.createElement('div');
		row.style.cssText = `display:flex;align-items:baseline;justify-content:space-between;gap:${6 * s}px;`;

		const label = document.createElement('span');
		label.style.cssText = `font-size:${8.5 * s}px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${palette.text};display:block;`;
		label.textContent = CATEGORY_LABELS[group.category] || group.category.replace(/_/g, ' ');
		row.appendChild(label);

		const count = document.createElement('span');
		count.style.cssText = `font-size:${7.5 * s}px;font-weight:800;color:${palette.mutedText};flex-shrink:0;`;
		count.textContent = group.count;
		row.appendChild(count);
		body.appendChild(row);

		if (group.names.length) {
			const namesWrap = document.createElement('div');
			namesWrap.style.cssText = `display:flex;flex-direction:column;gap:${2 * s}px;margin-top:${4 * s}px;`;

			group.names.slice(0, 4).forEach((nameValue) => {
				const tag = document.createElement('div');
				tag.style.cssText = [
					'display:block',
					'max-width:100%',
					`color:${palette.text}`,
					`font-size:${7 * s}px`,
					`font-weight:600`,
					`line-height:1.25`,
					`white-space:nowrap`,
					`overflow:hidden`,
					`text-overflow:ellipsis`
				].join(';');
				tag.textContent = nameValue;
				namesWrap.appendChild(tag);
			});

			if (group.names.length > 4) {
				const more = document.createElement('div');
				more.style.cssText = `display:block;color:${palette.mutedText};font-size:${6.5 * s}px;font-weight:800;line-height:1.2;text-transform:uppercase;letter-spacing:0.08em;`;
				more.textContent = `+${group.names.length - 4} more`;
				namesWrap.appendChild(more);
			}

			body.appendChild(namesWrap);
		}

		card.appendChild(body);
		grid.appendChild(card);
	});

	inner.appendChild(grid);

	legend.appendChild(inner);
}
