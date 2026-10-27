import { BookmarkIcon } from './icons.jsx';

export default function SavedAvatar({ size = 42 }) {
  return <span className="saved-avatar" style={{ width: size, height: size }} aria-hidden="true"><BookmarkIcon width={size * 0.52} height={size * 0.52} /></span>;
}
