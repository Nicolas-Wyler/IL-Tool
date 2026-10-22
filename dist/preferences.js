import { numberValue, setNumber } from './numbers.js';
export const APP_VERSION = '1.1.2';
export const DEFAULT_RESOLUTION = 640;
export const validResolution = value => Number.isInteger(value) && value >= 1 && value <= 4096;

export function setupPreferences({ getResolution, setResolution, resetProgram }) {
  const dialog = document.querySelector('#app-settings');
  const resolution = document.querySelector('#export-resolution');
  document.querySelector('#app-version').textContent = `Version ${APP_VERSION}`;
  document.querySelector('#open-settings').addEventListener('click', () => {
    setNumber(resolution, getResolution()); dialog.showModal(); document.body.classList.add('settings-open');
  });
  document.querySelector('#close-settings').addEventListener('click', () => dialog.close());
  document.querySelector('#reset-program').addEventListener('click', () => { resetProgram(); dialog.close(); });
  resolution.addEventListener('input', () => {
    const value = numberValue(resolution);
    if (validResolution(value)) setResolution(value);
  });
  dialog.addEventListener('close', () => {
    setNumber(resolution, getResolution()); document.body.classList.remove('settings-open');
  });
}
