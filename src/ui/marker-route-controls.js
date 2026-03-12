import { state, updateState } from '../core/state.js';
import { updateMarkerStyles, updateRouteStyles, updateRouteGeometry } from '../map/map-init.js';
import { updateEntityLegend } from '../map/entity-marker-manager.js';
import { getMarkerPlacementMode, getSelectedMarkerIndex, removeSelectedMarker, selectMarker, setMarkerPlacementMode } from '../map/marker-manager.js';

export function setupMarkerRouteControls() {
	const markerToggle = document.getElementById('show-marker-toggle');
	const routeToggle = document.getElementById('show-route-toggle');
	const markerSettings = document.getElementById('marker-settings');
	const markerIconSelect = document.getElementById('marker-icon-select');
	const markerSizeSlider = document.getElementById('marker-size-slider');
	const markerSizeValue = document.getElementById('marker-size-value');
	const placeMarkerBtn = document.getElementById('place-marker-btn');
	const markerPlacementHint = document.getElementById('marker-placement-hint');
	const selectedMarkerPanel = document.getElementById('selected-marker-panel');
	const selectedMarkerName = document.getElementById('selected-marker-name');
	const selectedMarkerCoords = document.getElementById('selected-marker-coords');
	const removeSelectedMarkerBtn = document.getElementById('remove-selected-marker-btn');
	const legendToggle = document.getElementById('show-legend-toggle');
	const legendScaleSlider = document.getElementById('legend-scale-slider');
	const legendScaleValue = document.getElementById('legend-scale-value');

	if (markerIconSelect) {
		markerIconSelect.addEventListener('change', (e) => {
			updateState({ markerIcon: e.target.value });
			updateMarkerStyles(state);
		});
	}

	if (markerSizeSlider) {
		markerSizeSlider.addEventListener('input', (e) => {
			const size = parseInt(e.target.value);
			updateState({ markerSize: size / 40.0 });
			updateMarkerStyles(state);
			if (markerSizeValue) markerSizeValue.textContent = `${size}px`;
		});
	}

	if (legendToggle) {
		legendToggle.addEventListener('change', (e) => {
			updateState({ showEntityLegend: e.target.checked });
			updateEntityLegend(state);
		});
	}

	if (legendScaleSlider) {
		legendScaleSlider.addEventListener('input', (e) => {
			const scale = parseInt(e.target.value) / 10;
			updateState({ entityLegendScale: scale });
			updateEntityLegend(state);
			if (legendScaleValue) legendScaleValue.textContent = `${scale.toFixed(1)}x`;
		});
	}

	if (markerToggle) {
		markerToggle.addEventListener('change', (e) => {
			const show = e.target.checked;
			if (show && (!state.markers || state.markers.length === 0)) {
				updateState({ markers: [{ lat: state.lat, lon: state.lon }] });
				selectMarker(0);
			}
			updateState({ showMarker: show });
			updateMarkerStyles(state);
			const settings = document.getElementById('marker-settings');
			if (settings) settings.classList.toggle('hidden', !show);
		});
	}

	const addMarkerBtn = document.getElementById('add-marker-btn');
	if (addMarkerBtn) {
		addMarkerBtn.addEventListener('click', () => {
			const newMarkers = [...(state.markers || [])];
			newMarkers.push({ lat: state.lat, lon: state.lon });
			selectMarker(newMarkers.length - 1);
			updateState({ markers: newMarkers });
			updateMarkerStyles(state);
		});
	}

	const removeMarkerBtn = document.getElementById('remove-marker-btn');
	if (removeMarkerBtn) {
		removeMarkerBtn.addEventListener('click', () => {
			const newMarkers = [...(state.markers || [])];
			if (newMarkers.length > 0) {
				newMarkers.pop();
				updateState({ markers: newMarkers });
				updateMarkerStyles(state);
			}
		});
	}

	if (placeMarkerBtn) {
		placeMarkerBtn.addEventListener('click', () => {
			if (!state.showMarker) {
				updateState({ showMarker: true });
			}
			setMarkerPlacementMode(!getMarkerPlacementMode());
			updateMarkerStyles(state);
		});
	}

	if (removeSelectedMarkerBtn) {
		removeSelectedMarkerBtn.addEventListener('click', () => {
			removeSelectedMarker();
			updateMarkerStyles(state);
		});
	}

	const clearMarkersBtn = document.getElementById('clear-markers-btn');
	if (clearMarkersBtn) {
		clearMarkersBtn.addEventListener('click', () => {
			updateState({ markers: [], showMarker: false });
			if (markerToggle) markerToggle.checked = false;
			updateMarkerStyles(state);
			const settings = document.getElementById('marker-settings');
			if (settings) settings.classList.add('hidden');
		});
	}

	if (routeToggle) {
		routeToggle.addEventListener('change', async (e) => {
			const show = e.target.checked;
			if (show) {
				updateState({
					routeStartLat: state.lat, routeStartLon: state.lon,
					routeEndLat: state.lat - 0.005, routeEndLon: state.lon + 0.005,
					routeViaPoints: []
				});
				await updateRouteGeometry();
			}
			updateState({ showRoute: show });
			const settings = document.getElementById('route-settings');
			if (settings) settings.classList.toggle('hidden', !show);
			updateRouteStyles(state);
		});
	}

	const resetRouteBtn = document.getElementById('reset-route-btn');
	if (resetRouteBtn) {
		resetRouteBtn.addEventListener('click', async () => {
			updateState({ routeViaPoints: [] });
			await updateRouteGeometry();
			updateRouteStyles(state);
		});
	}

	return {
		syncMarkerRouteUI(currentState) {
			if (markerToggle) {
				markerToggle.checked = !!currentState.showMarker;
				const settings = document.getElementById('marker-settings');
				if (settings) settings.classList.toggle('hidden', !currentState.showMarker);
			}

			const markerCountDisplay = document.getElementById('marker-count');
			if (markerCountDisplay) {
				markerCountDisplay.textContent = (currentState.markers || []).length;
			}
			const selectedIndex = getSelectedMarkerIndex();
			const selectedMarker = selectedIndex >= 0 ? (currentState.markers || [])[selectedIndex] : null;
			const placementMode = getMarkerPlacementMode();

			if (markerIconSelect) markerIconSelect.value = currentState.markerIcon || 'hexagon';
			if (markerSizeSlider) {
				const size = Math.round((currentState.markerSize || 1) * 40);
				markerSizeSlider.value = size;
				if (markerSizeValue) markerSizeValue.textContent = `${size}px`;
			}
			if (legendToggle) {
				legendToggle.checked = currentState.showEntityLegend !== false;
			}
			if (legendScaleSlider) {
				const scale = currentState.entityLegendScale || 1;
				legendScaleSlider.value = Math.round(scale * 10);
				if (legendScaleValue) legendScaleValue.textContent = `${scale.toFixed(1)}x`;
			}
			if (placeMarkerBtn) {
				placeMarkerBtn.classList.toggle('border-accent', placementMode);
				placeMarkerBtn.classList.toggle('text-accent', placementMode);
				placeMarkerBtn.textContent = placementMode ? 'Click Map…' : 'Place On Map';
			}
			if (markerPlacementHint) {
				if (placementMode) {
					markerPlacementHint.textContent = 'Click anywhere on the map canvas to add a marker.';
				} else if (selectedMarker) {
					markerPlacementHint.textContent = 'Drag the selected marker or remove it from the panel.';
				} else {
					markerPlacementHint.textContent = 'Select a marker or place a new one on the map.';
				}
			}
			if (selectedMarkerPanel) {
				selectedMarkerPanel.classList.toggle('hidden', !selectedMarker);
			}
			if (selectedMarkerName) {
				selectedMarkerName.textContent = selectedMarker ? `Marker ${selectedIndex + 1}` : '';
			}
			if (selectedMarkerCoords) {
				selectedMarkerCoords.textContent = selectedMarker ? `${selectedMarker.lat.toFixed(4)}, ${selectedMarker.lon.toFixed(4)}` : '';
			}

			if (routeToggle) {
				routeToggle.checked = !!currentState.showRoute;
				const settings = document.getElementById('route-settings');
				if (settings) settings.classList.toggle('hidden', !currentState.showRoute);
			}

			const routeCountDisplay = document.getElementById('route-count');
			if (routeCountDisplay) {
				const viaPoints = (currentState.routeViaPoints || []).length;
				routeCountDisplay.textContent = 2 + viaPoints;
			}
		}
	};
}
