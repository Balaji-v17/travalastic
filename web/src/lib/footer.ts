import { isPageAvailable, type BookTab, type Page, type PageStatus } from './pageStatus.ts';

export interface FooterLink {
  label: string;
  page: Page;
  status: PageStatus;
  bookTab?: BookTab;
  searchType?: 'flights' | 'hotels' | 'experiences' | 'packages';
}

export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Discover',
    links: [
      { label: 'Explore', page: 'explore', status: 'live' },
      { label: 'Journey AI', page: 'ai-planner', status: 'live' },
      { label: 'Popular destinations', page: 'explore', status: 'live' },
    ],
  },
  {
    heading: 'Book',
    links: [
      { label: 'Flights', page: 'book', bookTab: 'flights', status: 'live' },
      { label: 'Hotels', page: 'book', bookTab: 'hotels', status: 'live' },
      { label: 'Transfers', page: 'book', bookTab: 'cab', status: 'live' },
      { label: 'Car rental', page: 'book', bookTab: 'rental', status: 'live' },
      { label: 'Trains', page: 'book', bookTab: 'trains', status: 'live' },
      { label: 'Buses', page: 'book', bookTab: 'buses', status: 'live' },
      { label: 'Experiences', page: 'search', status: 'sample', searchType: 'experiences' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Privacy Policy', page: 'privacy', status: 'live' },
      { label: 'Delete Account', page: 'delete-account', status: 'live' },
      { label: 'Help Center', page: 'support', status: 'sample' },
    ],
  },
];

export function currentYear(now: Date = new Date()): number {
  return now.getFullYear();
}

export function filterFooterColumns(
  columns: FooterColumn[],
  showSample: boolean
): FooterColumn[] {
  return columns
    .map((col) => ({
      heading: col.heading,
      links: col.links.filter((link) => {
        if (link.status === 'live') {
          return isPageAvailable(link.page, showSample);
        }
        if (link.status === 'sample') {
          return showSample && isPageAvailable(link.page, showSample);
        }
        return false;
      }),
    }))
    .filter((col) => col.links.length > 0);
}
