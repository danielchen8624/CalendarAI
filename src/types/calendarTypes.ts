export type CalendarBlock = {
  id: string;
  kind: "item" | "external";
  title: string;
  startAt: string;
  endAt: string;
  calendarId: string;
  objectId: string | null;
  location: string | null;
};
