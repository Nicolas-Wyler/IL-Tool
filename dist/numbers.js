export function numberText(input) { return input.dataset.rawValue ?? input.value; }
export function numberValue(input) {
  const value = numberText(input);
  return value.trim() === '' ? NaN : Number(value);
}
export function formatNumber(value) {
  if (String(value).trim() === '' || !Number.isFinite(Number(value))) return '';
  const number = Number(value);
  return number !== 0 && (Math.abs(number) < .005 || Math.abs(number) >= 1e21)
    ? number.toExponential(2) : (Object.is(number, -0) ? 0 : number).toFixed(2);
}
export function setNumber(input, value) {
  input.dataset.rawValue = String(value ?? '');
  input.value = document.activeElement === input && !input.readOnly && input.dataset.derived !== 'true'
    ? input.dataset.rawValue : formatNumber(input.dataset.rawValue);
}
export function formatNumbers(root = document) {
  for (const input of root.querySelectorAll('input[type="number"]')) setNumber(input, numberText(input));
}
export function setupNumbers() {
  document.addEventListener('input', event => {
    if (event.target.matches('input[type="number"]')) event.target.dataset.rawValue = event.target.value;
  }, true);
  document.addEventListener('focusin', event => {
    const input = event.target;
    if (input.matches('input[type="number"]') && !input.readOnly && input.dataset.derived !== 'true') input.value = numberText(input);
  });
  document.addEventListener('focusout', event => {
    if (event.target.matches('input[type="number"]')) setNumber(event.target, numberText(event.target));
  });
}
