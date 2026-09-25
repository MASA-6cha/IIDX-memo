import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';
import '../app/activity.css';
import '../app/settings-sections.css';
import '../app/chart-features.css';
import '../app/catalog-import.css';

createRoot(document.getElementById('root')!).render(<Home/>);
