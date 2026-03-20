import { useState } from "react";
import type { User } from "../types";

type AppHeaderProps = {
  user: User;
  onOpenSettings: () => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onLogout: () => void;
};

function AppHeader({
  user,
  onOpenSettings,
  searchTerm,
  setSearchTerm,
  onLogout,
}: AppHeaderProps) {
  const baseUrl = import.meta.env.BASE_URL;
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  return (
    <div className="app-header">
      <a
        className="app-brand"
        href={baseUrl}
        onMouseEnter={() => setIsLogoHovered(true)}
        onMouseLeave={() => setIsLogoHovered(false)}
        onMouseUp={() => setIsLogoHovered(false)}
      >
        <img
          src={`${baseUrl}${isLogoHovered ? "ishi-logo-green.svg" : "ishi-logo-dark.svg"}`}
          alt="Ishi"
        />
      </a>
      <h3
        style={{
          margin: "auto 1rem auto auto",
          padding: 0,
        }}
      >
        Welcome, {user.name}
      </h3>

      <div className="header-search">
        {showSearch ? (
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search projects and issues"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowSearch(false);
                }
              }}
              onBlur={() => {
                if (!searchTerm.trim()) {
                  setShowSearch(false);
                }
              }}
              autoFocus
            />
            {searchTerm.trim().length > 0 && (
              <button
                type="button"
                className="search-close"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="search-toggle"
            onClick={() => setShowSearch(true)}
            aria-label="Open search"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
        )}
        <button
          type="button"
          className="header-icon header-icon-button"
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          <i className="fa-solid fa-gear" aria-hidden="true"></i>
        </button>
      </div>

      <div style={{ margin: "auto 0" }}>
        <button type="button" id="button-logout" className="button-pill" onClick={onLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}

export default AppHeader;
