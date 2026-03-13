import L from 'leaflet';
import { state, updateState, getSelectedTheme, getSelectedArtisticTheme } from '../core/state.js';
import { markerIcons } from '../core/marker-icons.js';
import { getMap, getArtisticMap, loadMapLibreModule } from './map-init.js';

let markers = [];
let artisticMarkers = [];
let selectedMarkerIndex = 0;
let placementMode = false;
let artisticRenderVersion = 0;

export function getMarkers() { return markers; }
export function getArtisticMarkers() { return artisticMarkers; }
export function getSelectedMarkerIndex() { return selectedMarkerIndex; }
export function getMarkerPlacementMode() { return placementMode; }

export function clearMarkers() {
	markers.forEach(m => m.remove());
	artisticMarkers.forEach(m => m.remove());
	markers = [];
	artisticMarkers = [];
}

function clampSelectedMarkerIndex(markerList) {
	if (!markerList.length) {
		selectedMarkerIndex = -1;
		return;
	}
	if (selectedMarkerIndex < 0 || selectedMarkerIndex >= markerList.length) {
		selectedMarkerIndex = markerList.length - 1;
	}
}

export function selectMarker(index) {
	selectedMarkerIndex = index;
	updateMarkerStyles(state);
}

export function setMarkerPlacementMode(enabled) {
	placementMode = !!enabled;
}

export function placeMarkerAt(lat, lon, options = {}) {
	const nextMarkers = [...(state.markers || []), { lat, lon }];
	selectedMarkerIndex = nextMarkers.length - 1;
	updateState({
		showMarker: true,
		markers: nextMarkers
	});
	if (options.keepPlacementMode !== true) {
		placementMode = false;
	}
}

export function removeSelectedMarker() {
	if (!state.markers || selectedMarkerIndex < 0 || selectedMarkerIndex >= state.markers.length) return;
	const nextMarkers = state.markers.filter((_, index) => index !== selectedMarkerIndex);
	selectedMarkerIndex = Math.min(selectedMarkerIndex, nextMarkers.length - 1);
	updateState({
		markers: nextMarkers,
		showMarker: nextMarkers.length > 0 ? state.showMarker : false
	});
}

function getIconAnchor(iconName, size) {
	if (iconName === 'pin') return [size / 2, size];
	return [size / 2, size / 2];
}

export function updateMarkerStyles(currentState) {
	const map = getMap();
	const artisticMap = getArtisticMap();
	if (!map) return;
	const renderVersion = ++artisticRenderVersion;

	markers.forEach(m => m.remove());
	artisticMarkers.forEach(m => m.remove());
	markers = [];
	artisticMarkers = [];

	if (!currentState.showMarker) return;

	const iconType = currentState.markerIcon || 'pin';
	const baseSize = 40;
	const size = Math.round(baseSize * (currentState.markerSize || 1));
	clampSelectedMarkerIndex(currentState.markers || []);

	const isArtistic = currentState.renderMode === 'artistic';
	const theme = isArtistic ? getSelectedArtisticTheme() : getSelectedTheme();
	const color = theme.route || (isArtistic ? (theme.text || '#0f172a') : (theme.textColor || '#0f172a'));

	const html = (markerIcons[iconType] || markerIcons.pin)
		.replace('class="marker-pin"', `style="width: ${size}px; height: ${size}px; color: ${color};"`);

	const anchorX = size / 2;
	const anchorY = iconType === 'pin' ? size : size / 2;

	(currentState.markers || []).forEach((markerData, index) => {
		const isSelected = index === selectedMarkerIndex;
		const icon = L.divIcon({
			className: `custom-marker${isSelected ? ' selected' : ''}`,
			html: html,
			iconSize: [size, size],
			iconAnchor: [anchorX, anchorY]
		});

		const lMarker = L.marker([markerData.lat, markerData.lon], {
			icon: icon,
			draggable: true
		}).addTo(map);

		lMarker.on('dragend', () => {
			const pos = lMarker.getLatLng();
			const newMarkers = [...currentState.markers];
			newMarkers[index] = { lat: pos.lat, lon: pos.lng };
			updateState({ markers: newMarkers });
		});

		lMarker.on('click', (e) => {
			L.DomEvent.stopPropagation(e);
			selectMarker(index);
		});

		lMarker.on('dblclick', (e) => {
			L.DomEvent.stopPropagation(e);
			selectedMarkerIndex = Math.max(0, index - 1);
			const newMarkers = currentState.markers.filter((_, i) => i !== index);
			updateState({ markers: newMarkers });
		});

		markers.push(lMarker);

		if (artisticMap) {
			loadMapLibreModule().then(mod => {
				if (renderVersion !== artisticRenderVersion) return;
				const mgl = mod.default || mod;
				const el = document.createElement('div');
				el.className = 'custom-marker';
				el.style.width = size + 'px';
				el.style.height = size + 'px';
				const parser = new DOMParser();
				const svgDoc = parser.parseFromString(html, 'text/html');
				while (svgDoc.body.firstChild) el.appendChild(svgDoc.body.firstChild);
				el.classList.toggle('selected', isSelected);
				el.style.cursor = 'pointer';

				el.addEventListener('click', (e) => {
					e.stopPropagation();
					selectMarker(index);
				});

				el.addEventListener('dblclick', (e) => {
					e.stopPropagation();
					selectedMarkerIndex = Math.max(0, index - 1);
					const newMarkers = currentState.markers.filter((_, i) => i !== index);
					updateState({ markers: newMarkers });
				});

				const aMarker = new mgl.Marker({
					element: el,
					draggable: true,
					anchor: iconType === 'pin' ? 'bottom' : 'center'
				})
					.setLngLat([markerData.lon, markerData.lat])
					.addTo(artisticMap);
				if (renderVersion !== artisticRenderVersion) {
					aMarker.remove();
					return;
				}

				aMarker.on('dragend', () => {
					const pos = aMarker.getLngLat();
					const newMarkers = [...currentState.markers];
					newMarkers[index] = { lat: pos.lat, lon: pos.lng };
					updateState({ markers: newMarkers });
				});

				artisticMarkers.push(aMarker);
			});
		}
	});
}

export function updateMarkerIcon(iconName, size) {
	updateMarkerStyles(state);
}

export function updateMarkerSize(size, iconName) {
	updateMarkerStyles(state);
}

export function updateMarkerVisibility(show) {
	updateMarkerStyles(state);
}

export function updateMarkerPosition(lat, lon) {
	const newMarkers = [...state.markers];
	if (newMarkers.length > 0) {
		const targetIndex = selectedMarkerIndex >= 0 ? selectedMarkerIndex : 0;
		newMarkers[targetIndex] = { lat, lon };
		updateState({ markers: newMarkers });
	} else {
		selectedMarkerIndex = 0;
		updateState({ markers: [{ lat, lon }] });
	}
}
