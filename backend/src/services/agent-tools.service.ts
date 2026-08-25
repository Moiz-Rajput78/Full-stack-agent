import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  cancelMeeting,
  checkCalendarBusy,
  createMeeting,
  listUpcomingMeetings,
  searchCalendarEvents,
  rescheduleMeeting,
  updateMeetingAgenda,
} from "./calendar.servics.js";

export function createCalendarTools(
  authUserId: string,
) {
  return {
    /**
     * ============================================================
     * LIST UPCOMING MEETINGS
     * ============================================================
     */
    listUpcomingMeetings: createTool({
      id: "listUpcomingMeetings",

      description:
        "List Google Calendar events. Use this for questions about today's meetings, tomorrow's meetings, upcoming meetings, schedules, agendas, or the user's calendar. Returns event IDs, titles, start/end times, attendees, locations and Meet links.",

      inputSchema: z.object({
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe(
            "Maximum number of events to return.",
          ),

        todayOnly: z
          .boolean()
          .optional()
          .describe(
            "If true, return only today's events.",
          ),

        tomorrowOnly: z
          .boolean()
          .optional()
          .describe(
            "If true, return only tomorrow's events.",
          ),
      }),

      execute: async (input) => {
        return await listUpcomingMeetings({
          authUserId,

          maxResults:
            input.maxResults,

          todayOnly:
            input.todayOnly,

          tomorrowOnly:
            input.tomorrowOnly,
        });
      },
    }),

    /**
     * ============================================================
     * SEARCH CALENDAR EVENTS
     * ============================================================
     */
    searchCalendarEvents: createTool({
      id: "searchCalendarEvents",

      description:
        "Search the user's Google Calendar for events between any two dates. Use this for past events, historical calendar searches, date-range searches, monthly history, yearly history, or requests such as 'past 30 days', 'past 10 years', 'last month', or 'events between two dates'. This tool can return both past and future events.",

      inputSchema: z.object({
        startIso: z
          .string()
          .describe(
            "Beginning of the date range as an ISO-8601 datetime.",
          ),

        endIso: z
          .string()
          .describe(
            "End of the date range as an ISO-8601 datetime.",
          ),

        maxResults: z
          .number()
          .int()
          .min(1)
          .max(2500)
          .optional()
          .describe(
            "Maximum number of events to return.",
          ),
      }),

      execute: async ({
        startIso,
        endIso,
        maxResults,
      }) => {
        return await searchCalendarEvents({
          authUserId,

          startIso,

          endIso,

          maxResults,
        });
      },
    }),

    /**
     * ============================================================
     * CHECK CALENDAR BUSY
     * ============================================================
     */
    checkCalendarBusy: createTool({
      id: "checkCalendarBusy",

      description:
        "Check whether the user's primary Google Calendar is busy between two ISO-8601 datetimes.",

      inputSchema: z.object({
        startIso: z
          .string()
          .describe(
            "Start ISO-8601 datetime.",
          ),

        endIso: z
          .string()
          .describe(
            "End ISO-8601 datetime.",
          ),
      }),

      execute: async ({
        startIso,
        endIso,
      }) => {
        return await checkCalendarBusy({
          authUserId,

          startIso,

          endIso,
        });
      },
    }),

    /**
     * ============================================================
     * CREATE MEETING
     * ============================================================
     */
    createMeeting: createTool({
      id: "createMeeting",

      description:
        "Create a Google Calendar meeting. Use this when the user asks to create, schedule, book or add a meeting.",

      inputSchema: z.object({
        title: z
          .string()
          .min(1),

        startIso: z
          .string()
          .describe(
            "Meeting start as ISO-8601 datetime.",
          ),

        endIso: z
          .string()
          .describe(
            "Meeting end as ISO-8601 datetime.",
          ),

        attendeeEmails: z
          .array(
            z.string().email(),
          )
          .optional(),

        description:
          z.string().optional(),

        addGoogleMeet: z
          .boolean()
          .optional()
          .describe(
            "Whether to add Google Meet. Defaults to true.",
          ),
      }),

      execute: async (input) => {
        return await createMeeting({
          authUserId,

          ...input,
        });
      },
    }),

    /**
     * ============================================================
     * RESCHEDULE MEETING
     * ============================================================
     */
    rescheduleMeeting: createTool({
      id: "rescheduleMeeting",

      description:
        "Reschedule an existing Google Calendar event. First find the event with searchCalendarEvents if the event ID is not already known.",

      inputSchema: z.object({
        eventId: z
          .string()
          .min(1),

        startIso: z
          .string()
          .describe(
            "New meeting start as ISO-8601 datetime.",
          ),

        endIso: z
          .string()
          .describe(
            "New meeting end as ISO-8601 datetime.",
          ),
      }),

      execute: async (input) => {
        return await rescheduleMeeting({
          authUserId,

          ...input,
        });
      },
    }),

    /**
     * ============================================================
     * UPDATE MEETING AGENDA
     * ============================================================
     */
    updateMeetingAgenda: createTool({
      id: "updateMeetingAgenda",

      description:
        "Update the agenda or description of an existing Google Calendar event. Do not create a new event.",

      inputSchema: z.object({
        eventId: z
          .string()
          .min(1),

        agenda: z
          .string()
          .min(1),

        mode: z
          .enum([
            "append",
            "replace",
          ])
          .optional()
          .describe(
            "Append the agenda to the existing description or replace the existing description.",
          ),
      }),

      execute: async (input) => {
        return await updateMeetingAgenda({
          authUserId,

          ...input,
        });
      },
    }),

    /**
     * ============================================================
     * CANCEL MEETING
     * ============================================================
     */
    cancelMeeting: createTool({
      id: "cancelMeeting",

      description:
        "Cancel an existing Google Calendar event. First find the event with searchCalendarEvents if the event ID is not known.",

      inputSchema: z.object({
        eventId: z
          .string()
          .min(1),
      }),

      execute: async (input) => {
        return await cancelMeeting({
          authUserId,

          ...input,
        });
      },
    }),
  };
}
