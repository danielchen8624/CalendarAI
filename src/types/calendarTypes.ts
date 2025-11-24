export type CalendarBlock = {
  id: string;
  kind: "item" | "external";
  title: string;
  startAt: string;
  endAt: string;
  calendarId: string;
  objectId: string | null;
  location: string | null;
  source: "item" | "outside"; // which table this came from
  sourceId: string; // the primary key of that row in that table
  providerEventId: string | null; // Google event id for external only
};
