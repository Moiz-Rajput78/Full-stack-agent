import { google } from "googleapis";
import { randomUUID } from "node:crypto";

import {
  getCalendarAccessToken,
} from "./token.service.js";

/**
 * ============================================================
 * GOOGLE CALENDAR CLIENT
 * ============================================================
 */

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

/**
 * ============================================================
 * EVENT FORMATTER
 * ============================================================
 */

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

  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string | null;
      uri?: string | null;
    }> | null;
  } | null;

  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
  }> | null;
}) {
  /**
   * Google Meet link can exist either in
   * hangoutLink or conferenceData.entryPoints.
   */
  let meetLink =
    event.hangoutLink ??
    null;

  if (!meetLink) {
    const videoEntry =
      (
        event.conferenceData
          ?.entryPoints ?? []
      ).find(
        (entry) =>
          entry.entryPointType ===
            "video" &&
          typeof entry.uri ===
            "string",
      );

    meetLink =
      videoEntry?.uri ??
      null;
  }

  return {
    id:
      event.id ??
      null,

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

    meetLink,

    attendees:
      (
        event.attendees ?? []
      )
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
 * ============================================================
 * LOCAL DAY RANGE
 * ============================================================
 *
 * Used for:
 * - today
 * - tomorrow
 */

function getLocalDayRange(
  offsetDays = 0,
) {
  const start =
    new Date();

  start.setHours(
    0,
    0,
    0,
    0,
  );

  start.setDate(
    start.getDate() +
      offsetDays,
  );

  const end =
    new Date(start);

  end.setDate(
    end.getDate() + 1,
  );

  return {
    timeMin:
      start.toISOString(),

    timeMax:
      end.toISOString(),
  };
}

/**
 * ============================================================
 * LIST UPCOMING MEETINGS
 * ============================================================
 *
 * Used for:
 * - today's meetings
 * - tomorrow's meetings
 * - upcoming meetings
 *
 * IMPORTANT:
 * This function is NOT intended for historical searches.
 *
 * For past events use searchCalendarEvents().
 */

export async function listUpcomingMeetings(
  input: {
    authUserId: string;

    maxResults?: number;

    todayOnly?: boolean;

    tomorrowOnly?: boolean;
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  let timeMin: string;

  let timeMax:
    | string
    | undefined;

  /**
   * Tomorrow
   *
   * Check tomorrow first so that if
   * both flags are accidentally true,
   * tomorrow wins.
   */
  if (input.tomorrowOnly) {
    const range =
      getLocalDayRange(1);

    timeMin =
      range.timeMin;

    timeMax =
      range.timeMax;
  }

  /**
   * Today
   */
  else if (input.todayOnly) {
    const range =
      getLocalDayRange(0);

    timeMin =
      range.timeMin;

    timeMax =
      range.timeMax;
  }

  /**
   * Normal upcoming events
   */
  else {
    timeMin =
      new Date().toISOString();
  }

  const response =
    await calendar.events.list({
      calendarId:
        "primary",

      timeMin,

      timeMax,

      maxResults:
        input.maxResults ??
        20,

      singleEvents:
        true,

      orderBy:
        "startTime",
    });

  return (
    response.data.items ??
    []
  ).map(formatEvent);
}

/**
 * ============================================================
 * SEARCH CALENDAR EVENTS
 * ============================================================
 *
 * This is the important function for historical data.
 *
 * It supports:
 *
 * - past 30 days
 * - past 90 days
 * - past year
 * - past 10 years
 * - last month
 * - events between two dates
 * - future date ranges
 *
 * Example:
 *
 * startIso = 2016-01-01T00:00:00.000Z
 * endIso   = 2026-01-01T00:00:00.000Z
 */

export async function searchCalendarEvents(
  input: {
    authUserId: string;

    startIso: string;

    endIso: string;

    maxResults?: number;
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  /**
   * Validate dates before sending
   * the request to Google.
   */
  const startDate =
    new Date(
      input.startIso,
    );

  const endDate =
    new Date(
      input.endIso,
    );

  if (
    Number.isNaN(
      startDate.getTime(),
    )
  ) {
    throw new Error(
      "Invalid startIso date.",
    );
  }

  if (
    Number.isNaN(
      endDate.getTime(),
    )
  ) {
    throw new Error(
      "Invalid endIso date.",
    );
  }

  if (
    startDate >= endDate
  ) {
    throw new Error(
      "startIso must be before endIso.",
    );
  }

  /**
   * Google Calendar allows up to 2500
   * results per API request.
   */
  const requestedMax =
    Math.min(
      Math.max(
        input.maxResults ??
          2500,
        1,
      ),
      2500,
    );

  const events:
    ReturnType<
      typeof formatEvent
    >[] = [];

  let pageToken:
    | string
    | undefined;

  do {
    const remaining =
      requestedMax -
      events.length;

    if (remaining <= 0) {
      break;
    }

    const response =
      await calendar.events.list({
        calendarId:
          "primary",

        timeMin:
          startDate.toISOString(),

        timeMax:
          endDate.toISOString(),

        maxResults:
          Math.min(
            remaining,
            2500,
          ),

        pageToken,

        singleEvents:
          true,

        orderBy:
          "startTime",
      });

    const pageEvents =
      response.data.items ??
      [];

    events.push(
      ...pageEvents.map(
        formatEvent,
      ),
    );

    pageToken =
      response.data
        .nextPageToken ??
      undefined;

  } while (
    pageToken &&
    events.length <
      requestedMax
  );

  /**
   * Make absolutely sure we never
   * return more than requested.
   */
  return events.slice(
    0,
    requestedMax,
  );
}

/**
 * ============================================================
 * CREATE EVENT
 * ============================================================
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
    input.addGoogleMeet !==
    false;

  const attendeeEmails =
    input.attendeeEmails ??
    [];

  const response =
    await calendar.events.insert({
      calendarId:
        "primary",

      sendUpdates:
        attendeeEmails.length >
        0
          ? "all"
          : "none",

      conferenceDataVersion:
        withMeet
          ? 1
          : undefined,

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
          attendeeEmails.map(
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
      attendeeEmails.length >
      0,

    googleMeetAdded:
      withMeet,
  };
}

/**
 * ============================================================
 * CANCEL EVENT
 * ============================================================
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
    calendarId:
      "primary",

    eventId:
      input.eventId,

    sendUpdates:
      "all",
  });

  return {
    cancelled:
      true,

    eventId:
      input.eventId,
  };
}

/**
 * ============================================================
 * RESCHEDULE EVENT
 * ============================================================
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
      calendarId:
        "primary",

      eventId:
        input.eventId,

      sendUpdates:
        "all",

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
 * ============================================================
 * UPDATE MEETING AGENDA
 * ============================================================
 */

export async function updateMeetingAgenda(
  input: {
    authUserId: string;

    eventId: string;

    agenda: string;

    mode?:
      | "append"
      | "replace";
  },
) {
  const calendar =
    await calendarForUser(
      input.authUserId,
    );

  const existing =
    await calendar.events.get({
      calendarId:
        "primary",

      eventId:
        input.eventId,
    });

  const existingDescription =
    existing.data.description?.trim() ??
    "";

  const newAgenda =
    input.agenda.trim();

  const mode =
    input.mode ??
    "append";

  const updatedDescription =
    mode === "replace"
      ? newAgenda
      : existingDescription
        ? `${existingDescription}\n\n${newAgenda}`
        : newAgenda;

  const response =
    await calendar.events.patch({
      calendarId:
        "primary",

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
 * ============================================================
 * CHECK CALENDAR BUSY
 * ============================================================
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
            id:
              "primary",
          },
        ],
      },
    });

  const busy =
    response.data
      ?.calendars
      ?.primary
      ?.busy ??
    [];

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
