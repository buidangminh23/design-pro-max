import { useState } from 'react';
import { Tray } from './Tray';

export function App() {
  const [view, setView] = useState<'tray' | 'settings'>('tray');
  return (
    <main>
      <nav>
        <button onClick={() => setView('tray')}>Usage</button>
        <button onClick={() => setView('settings')}>Settings</button>
      </nav>
      {view === 'tray' ? <Tray /> : <section><h2>Settings</h2><p>Help</p></section>}
    </main>
  );
}
