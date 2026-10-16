import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'plane' | 'bed' | 'utensils' | 'bag' | 'train' | 'map' | 'alert' | 'chat' | 'edit' | 'ticket' | 'globe'
  | 'mic' | 'speaker' | 'flame' | 'star' | 'target' | 'home' | 'passport' | 'chart' | 'check' | 'close'
  | 'arrowLeft' | 'arrowRight' | 'lock' | 'wifiOff' | 'car' | 'coffee' | 'abc' | 'hash' | 'people' | 'medal'
  | 'repeat' | 'book';

type Props = { name: IconName; size?: number; color?: string; fill?: string; strokeWidth?: number };

/** Stroke icons drawn inline (no icon font), matching the design's line weight. */
export function Icon({ name, size = 22, color = '#232A31', fill = 'none', strokeWidth = 1.9 }: Props) {
  const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {paths(name, common)}
    </Svg>
  );
}

type Common = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: string;
};

function paths(name: IconName, c: Common) {
  const line = { ...c, fill: 'none' };
  switch (name) {
    case 'plane':
      return <Path {...line} d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />;
    case 'bed':
      return <Path {...line} d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />;
    case 'utensils':
      return <Path {...line} d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />;
    case 'bag':
      return <Path {...line} d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />;
    case 'train':
      return <Path {...line} d="M8 3h8a4 4 0 0 1 4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a4 4 0 0 1 4-4zM4 11h16M12 3v8M8 21l2-4M16 21l-2-4" />;
    case 'map':
      return <Path {...line} d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />;
    case 'alert':
      return <Path {...c} d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />;
    case 'chat':
      return <Path {...line} d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" />;
    case 'edit':
      return <Path {...line} d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />;
    case 'ticket':
      return <Path {...line} d="M3 8a2 2 0 0 0 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 0-4V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zM13 4v14" />;
    case 'globe':
      return (
        <>
          <Circle {...line} cx="12" cy="12" r="10" />
          <Path {...line} d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </>
      );
    case 'mic':
      return (
        <>
          <Rect {...line} x="9" y="2" width="6" height="12" rx="3" />
          <Path {...line} d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
        </>
      );
    case 'speaker':
      return <Path {...line} d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />;
    case 'flame':
      return <Path {...c} d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />;
    case 'star':
      return <Path {...c} d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.1 2 9.3l6.9-1z" />;
    case 'target':
      return (
        <>
          <Circle {...line} cx="12" cy="12" r="10" />
          <Circle {...line} cx="12" cy="12" r="6" />
          <Circle {...line} cx="12" cy="12" r="2" />
        </>
      );
    case 'home':
      return <Path {...c} d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />;
    case 'passport':
      return (
        <>
          <Rect {...c} x="4" y="2" width="16" height="20" rx="2" />
          <Circle {...line} cx="12" cy="10" r="3" />
          <Path {...line} d="M8 17h8" />
        </>
      );
    case 'chart':
      return <Path {...line} d="M3 3v18h18M7 15l4-4 3 3 5-6" />;
    case 'check':
      return <Path {...line} d="M20 6 9 17l-5-5" />;
    case 'close':
      return <Path {...line} d="M18 6 6 18M6 6l12 12" />;
    case 'arrowLeft':
      return <Path {...line} d="M19 12H5M12 19l-7-7 7-7" />;
    case 'arrowRight':
      return <Path {...line} d="M5 12h14M13 5l7 7-7 7" />;
    case 'lock':
      return (
        <>
          <Rect {...line} x="5" y="11" width="14" height="10" rx="2" />
          <Path {...line} d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      );
    case 'car':
      return (
        <>
          <Path {...line} d="M5 17H3v-5l2-5h14l2 5v5h-2M5 12h14" />
          <Circle {...line} cx="7.5" cy="17" r="2" />
          <Circle {...line} cx="16.5" cy="17" r="2" />
        </>
      );
    case 'coffee':
      return <Path {...line} d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1a3 3 0 0 1 0 6h-1M8 2v3M12 2v3" />;
    case 'abc':
      return <Path {...line} d="M3 17l3.5-10L10 17M4.2 13.5h4.6M13 7v10h3a2.5 2.5 0 0 0 0-5h-3 2.5a2.5 2.5 0 0 0 0-5zM22 8.5A3.5 3.5 0 0 0 19.5 7" />;
    case 'hash':
      return <Path {...line} d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />;
    case 'people':
      return (
        <>
          <Circle {...line} cx="9" cy="8" r="3.5" />
          <Path {...line} d="M2 21c0-4 3-7 7-7s7 3 7 7M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.7 4 3.4 4 7" />
        </>
      );
    case 'medal':
      return (
        <>
          <Path {...line} d="M7 2l3 7M17 2l-3 7" />
          <Circle {...c} cx="12" cy="15" r="6" />
        </>
      );
    case 'repeat':
      return <Path {...line} d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />;
    case 'book':
      return <Path {...line} d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" />;
    case 'wifiOff':
      return <Path {...line} d="m2 2 20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5c4-.4 8.1.9 11.3 3.8M16.9 11.3a10 10 0 0 1 2.2 1.6M5 13a10 10 0 0 1 5.2-2.8M12 20h.01" />;
  }
}
