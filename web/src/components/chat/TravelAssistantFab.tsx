import { useApp, type Page } from '../../store/AppContext';

const ALLOWED_PAGES: Page[] = ['home', 'explore', 'search', 'destination', 'my-trips', 'journey'];

export default function TravelAssistantFab() {
  const { page, isTravelAssistantOpen, openTravelAssistant } = useApp();

  // Render FAB only on allowed pages (home, explore, search, destination, my-trips, journey)
  if (!ALLOWED_PAGES.includes(page)) {
    return null;
  }

  // When the assistant panel is open, keep the FAB in DOM or visually hidden so focus can return to it on close
  return (
    <button
      id="travel-assistant-fab"
      onClick={() => openTravelAssistant()}
      aria-label="Open Travel Assistant"
      aria-expanded={isTravelAssistantOpen}
      aria-controls="travel-assistant-panel"
      className={`fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-5 py-3 bg-[#2F6E68] hover:bg-[#265954] active:bg-[#1E4541] text-white rounded-full shadow-lg shadow-[#2F6E68]/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] min-h-[48px] min-w-[48px] focus:outline-none focus:ring-2 focus:ring-[#2F6E68] focus:ring-offset-2 ${
        isTravelAssistantOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Speech bubble / spark icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
      </svg>
      <span className="font-medium text-sm tracking-wide select-none">Travel Assistant</span>
    </button>
  );
}

