import { setupThemePicker } from './theme-picker.js';
import { setupLocationSearch } from './location-search.js';
import { setupMarkerRouteControls } from './marker-route-controls.js';
import { setupOverlaySettings } from './overlay-settings.js';
import { setupShellControls } from './shell-controls.js';
import { state, updateState, getSelectedTheme, getSelectedArtisticTheme } from '../core/state.js';
export { updatePreviewStyles } from './preview-styles.js';

function setupStudioFlow() {
	const summaryLocation = document.getElementById('studio-summary-location');
	const summaryStyle = document.getElementById('studio-summary-style');
	const summaryDetail = document.getElementById('studio-summary-detail');
	const summaryOutput = document.getElementById('studio-summary-output');
	const presetButtons = document.querySelectorAll('[data-design-preset]');

	const presetMap = {
		editorial: {
			renderMode: 'tile',
			theme: 'minimal',
			showLabels: false,
			overlayBgType: 'none',
			overlaySize: 'medium',
			showMarker: false,
			showEntityLegend: false,
			matEnabled: true,
			matWidth: 56,
			matShowBorder: true,
			matBorderOpacity: 0.5,
			showCountry: true,
			showCoords: true
		},
		directory: {
			renderMode: 'tile',
			theme: 'voyager',
			showLabels: false,
			showMarker: false,
			showEntityMarkers: true,
			showEntityLegend: true,
			markerIcon: 'hexagon',
			overlayBgType: 'vignette',
			overlaySize: 'small',
			matEnabled: false
		},
		neon: {
			renderMode: 'artistic',
			artisticTheme: 'cyber_noir',
			showLabels: false,
			showMarker: false,
			showEntityLegend: true,
			overlayBgType: 'none',
			overlaySize: 'small',
			matEnabled: false
		}
	};

	presetButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const preset = presetMap[button.dataset.designPreset];
			if (!preset) return;
			updateState(preset);
		});
	});

	return function syncStudioFlow(currentState) {
		const themeName = currentState.renderMode === 'artistic'
			? getSelectedArtisticTheme().name
			: getSelectedTheme().name;
		const cityName = currentState.cityOverride || currentState.city;
		const countryName = currentState.countryOverride || currentState.country;
		const detailBits = [];
		if (currentState.showEntityLegend !== false) detailBits.push('legend');
		if ((currentState.entityMarkers || []).length) detailBits.push(`${currentState.entityMarkers.length} pins`);
		if (currentState.showRoute) detailBits.push('route');
		if (currentState.showMarker) detailBits.push(currentState.markerIcon || 'marker');

		if (summaryLocation) summaryLocation.textContent = `${cityName}${countryName ? `, ${countryName}` : ''}`;
		if (summaryStyle) summaryStyle.textContent = themeName;
		if (summaryDetail) summaryDetail.textContent = detailBits.length ? detailBits.join(' / ') : 'clean canvas';
		if (summaryOutput) summaryOutput.textContent = `${currentState.width} × ${currentState.height}`;

		presetButtons.forEach((button) => {
			const isActive =
				(button.dataset.designPreset === 'editorial' && currentState.renderMode === 'tile' && currentState.theme === 'minimal' && currentState.matEnabled) ||
				(button.dataset.designPreset === 'directory' && currentState.renderMode === 'tile' && currentState.theme === 'voyager' && currentState.showEntityLegend !== false) ||
				(button.dataset.designPreset === 'neon' && currentState.renderMode === 'artistic' && currentState.artisticTheme === 'cyber_noir');
			button.classList.toggle('ring-2', isActive);
			button.classList.toggle('ring-accent', isActive);
			button.classList.toggle('border-accent', isActive);
		});
	};
}

export function setupControls() {
	const { syncThemeUI } = setupThemePicker();
	const { syncLocationUI, selectLocation } = setupLocationSearch();
	const { syncMarkerRouteUI } = setupMarkerRouteControls();
	const { syncOverlayUI } = setupOverlaySettings();
	const syncStudioFlow = setupStudioFlow();
	setupShellControls();

	return (currentState) => {
		syncStudioFlow(currentState);
		syncLocationUI(currentState);
		syncThemeUI(currentState);
		syncMarkerRouteUI(currentState);
		syncOverlayUI(currentState);
	};
}

export { setupLocationSearch } from './location-search.js';
