import App from './app.svelte'
import './components/barChart.svelte'
import './node_modules/@evidence-dev/evidence/template/src/app.css'

const appTarget = document.getElementById('app')!;

// Expose a tiny client-side bus for components and App to communicate
export const appBus = new EventTarget();
(window as any).appBus = appBus;

// Bridge appBus <-> window events for demo simplicity
window.addEventListener('ping', () => appBus.dispatchEvent(new Event('ping')));
appBus.addEventListener('ping', () => window.dispatchEvent(new Event('ping')));

new App({ target: appTarget });


