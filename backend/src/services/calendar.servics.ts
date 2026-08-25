import { google } from "googleapis";
import { randomUUID } from "node:crypto";

import {
  getCalendarAccessToken,
} from "./token.service.js";

function calendarClient(
  accessToken: string,
) {
  const auth =
    new google.auth.OAuth2();

  auth.setCredentials({
    access_token: accessToken,
  });

  return google.calendar({
    version: "v3",
    auth,
  });
}

async function calendarForUser(
  authUserId: string,
) {
  const accessToken =
    await getCalendarAccessToken(
      authUserId,
    );

  return calendarClient(
    accessToken,
  );
}

function formatEvent(event: {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;

  start?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;

  end?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;

  htmlLink?: string | null;
  hangoutLink?: string | null;

  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
  }> | null;
}) {
  return {
    id:
      event.id ?? null,

    title:
      event.summary?.trim() ||
      "(no title)",

    description:
      event.description?.trim() ||
      null,

    location:
      event.location?.trim() ||
      null,

    start:
      event.start?.dateTime ??
      event.start?.date ??
      null,

    end:
      event.end?.dateTime ??
      event.end?.date ??
      null,

    htmlLink:
      event.htmlLink ??
      null,

    meetLink:
      event.hangoutLink ??
      null,

    attendees:
      (event.attendees ?? [])
        .map(
          (person) =>
            person.email ||
            person.displayName,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
  };
}

/**
 * List upcoming events.
 */
export async function listUpcomingMeetings(
  input: {
    authUserId: string;
    maxResults?: number;
    todayOnly?: boolean;
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const now = new Date();

  let timeMin =
    now.toISOString();

  let timeMax:
    | string
    | undefined;

  if (input.todayOnly) {
    const start =
      new Date(now);

    start.setHours(
      0,
      0,
      0,
      0,
    );

    const end =
      new Date(now);

    end.setHours(
      23,
      59,
      59,
      999,
    );

    timeMin =
      start.toISOString();

    timeMax =
      end.toISOString();
  }

  const response =
    await calendar.events.list({
      calendarId: "primary",

      timeMin,

      timeMax,

      maxResults:
        input.maxResults ??
        20,

      singleEvents: true,

      orderBy: "startTime",
    });

  return (
    response.data.items ?? []
  ).map(formatEvent);
}

/**
 * Create event.
 */
export async function createMeeting(
  input: {
    authUserId: string;
    title: string;
    startIso: string;
    endIso: string;
    attendeeEmails?: string[];
    description?: string;
    addGoogleMeet?: boolean;
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const withMeet =
    input.addGoogleMeet !== false;

  const response =
    await calendar.events.insert({
      calendarId: "primary",

      sendUpdates: "all",

      conferenceDataVersion:
        withMeet ? 1 : undefined,

      requestBody: {
        summary:
          input.title,

        description:
          input.description,

        start: {
          dateTime:
            input.startIso,
        },

        end: {
          dateTime:
            input.endIso,
        },

        attendees:
          (
            input.attendeeEmails ??
            []
          ).map(
            (email) => ({
              email,
            }),
          ),

        conferenceData:
          withMeet
            ? {
                createRequest: {
                  requestId:
                    randomUUID(),

                  conferenceSolutionKey:
                    {
                      type:
                        "hangoutsMeet",
                    },
                },
              }
            : undefined,
      },
    });

  return {
    ...formatEvent(
      response.data,
    ),

    inviteEmailsSent:
      (
        input.attendeeEmails ??
        []
      ).length > 0,

    googleMeetAdded:
      withMeet,
  };
}

/**
 * Cancel event.
 */
export async function cancelMeeting(
  input: {
    authUserId: string;
    eventId: string;
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  await calendar.events.delete({
    calendarId: "primary",

    eventId:
      input.eventId,

    sendUpdates: "all",
  });

  return {
    cancelled: true,

    eventId:
      input.eventId,
  };
}

/**
 * Reschedule event.
 */
export async function rescheduleMeeting(
  input: {
    authUserId: string;
    eventId: string;
    startIso: string;
    endIso: string;
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const response =
    await calendar.events.patch({
      calendarId: "primary",

      eventId:
        input.eventId,

      sendUpdates: "all",

      requestBody: {
        start: {
          dateTime:
            input.startIso,
        },

        end: {
          dateTime:
            input.endIso,
        },
      },
    });

  return formatEvent(
    response.data,
  );
}

/**
 * Update agenda.
 */
export async function updateMeetingAgenda(
  input: {
    authUserId: string;
    eventId: string;
    agenda: string;
    mode?: "append" | "replace";
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const existing =
    await calendar.events.get({
      calendarId: "primary",

      eventId:
        input.eventId,
    });

  const existingDescription =
    existing.data.description?.trim() ??
    "";

  const newAgenda =
    input.agenda.trim();

  const mode =
    input.mode ?? "append";

  const updatedDescription =
    mode === "replace"
      ? newAgenda
      : existingDescription
        ? `${existingDescription}\n\n${newAgenda}`
        : newAgenda;

  const response =
    await calendar.events.patch({
      calendarId: "primary",

      eventId:
        input.eventId,

      requestBody: {
        description:
          updatedDescription,
      },
    });

  return formatEvent(
    response.data,
  );
}

/**
 * Check busy.
 */
export async function checkCalendarBusy(
  input: {
    authUserId: string;
    startIso: string;
    endIso: string;
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const response =
    await calendar.freebusy.query({
      requestBody: {
        timeMin:
          input.startIso,

        timeMax:
          input.endIso,

        items: [
          {
            id: "primary",
          },
        ],
      },
    });

  const busy =
    response.data
      ?.calendars
      ?.primary
      ?.busy ?? [];

  return {
    busy:
      busy.map(
        (item) => ({
          start:
            item.start ??
            null,

          end:
            item.end ??
            null,
        }),
      ),
  };
}