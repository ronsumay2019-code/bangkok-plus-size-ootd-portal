import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LoginGate} from './components/LoginGate';
import {installPortalFetch} from './utils/portalAuth';
import './index.css';

installPortalFetch();

createRoot(document.getElementById('root')!).render(
  <LoginGate>{(auth) => <App {...auth} />}</LoginGate>
);
