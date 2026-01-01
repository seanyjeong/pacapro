'use client';

import { createContext, useContext } from 'react';

// Orientation Context
export const OrientationContext = createContext<'portrait' | 'landscape'>('portrait');
export const useOrientation = () => useContext(OrientationContext);
