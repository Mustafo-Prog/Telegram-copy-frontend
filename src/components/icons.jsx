const baseProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function SendIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

export function SunIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function CheckCheckIcon(props) {
  return (
    <svg {...baseProps} width={16} height={16} strokeWidth={2} {...props}>
      <path d="m2 12.5 4.5 4.5L14 8" />
      <path d="m10.5 15.5 1.5 1.5L21 7" />
    </svg>
  );
}

export function CheckIcon(props) {
  return <svg {...baseProps} width={16} height={16} {...props}><path d="m5 12 4 4L19 6" /></svg>;
}

export function PaperclipIcon(props) {
  return <svg {...baseProps} {...props}><path d="m21 11-9 9a6 6 0 0 1-8.5-8.5l10-10a4 4 0 0 1 5.7 5.7L9 17.3a2 2 0 0 1-2.8-2.8l9-9" /></svg>;
}

export function SearchIcon(props) {
  return <svg {...baseProps} {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
}
export function MicIcon(props) {
  return <svg {...baseProps} {...props}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>;
}
export function PinIcon(props) {
  return <svg {...baseProps} {...props}><path d="m16 3 5 5-4 1-4 5v4l-3-3-6 6 6-6-3-3h4l5-4z" /></svg>;
}
export function BellIcon(props) {
  return <svg {...baseProps} {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
}

export function BookmarkIcon(props) {
  return <svg {...baseProps} {...props}><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4V4Z" /></svg>;
}

export function ImageIcon(props) {
  return <svg {...baseProps} {...props}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg>;
}

export function SettingsIcon(props) {
  return <svg {...baseProps} {...props}><path d="m9 3-.5 2-2 1.2-2-.6-2 3.4 1.5 1.5v2.4L2.5 14l2 3.4 2-.6 2 1.2.5 3h4l.5-3 2-1.2 2 .6 2-3.4-1.5-1.1v-2.4L20.5 9l-2-3.4-2 .6-2-1.2L14 3Z" /><circle cx="11.5" cy="12" r="3" /></svg>;
}
