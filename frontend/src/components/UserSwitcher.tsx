import type { User } from '../api/client';

interface Props {
  users: User[];
  currentUser: User | null;
  onSelect: (user: User) => void;
}

const ROLE_COLORS: Record<string, string> = {
  author: '#5b7cf6',
  reviewer: '#a78bfa',
  admin: '#f87171',
  viewer: '#34d399',
};

export function UserSwitcher({ users, currentUser, onSelect }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Login As</span>
      </div>
      <div className="user-switcher">
        {users.map((user) => (
          <button
            key={user.id}
            className={`user-btn ${currentUser?.id === user.id ? 'active' : ''}`}
            onClick={() => onSelect(user)}
            id={`user-btn-${user.role}`}
          >
            <div
              className="user-avatar"
              style={
                currentUser?.id === user.id
                  ? { background: ROLE_COLORS[user.role], color: 'white' }
                  : { background: `${ROLE_COLORS[user.role]}22`, color: ROLE_COLORS[user.role] }
              }
            >
              {user.name[0]}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
