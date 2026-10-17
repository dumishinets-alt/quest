import React from 'react';
import {AbsoluteFill} from 'remotion';
export const sparkOffsetY = (l: {vertical: boolean; u: number}) => (l.vertical ? -330 : -200) * l.u;
export const Scene6Finale: React.FC = () => <AbsoluteFill />;
