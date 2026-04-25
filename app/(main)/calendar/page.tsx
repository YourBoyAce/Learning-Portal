"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/app/lib/supabase";

type ViewType = "month" | "week" | "day";
type EventType = "video" | "course" | "session" | "webinar";

interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  time: string;
  type: EventType;
  tag: string;
}

interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  event_type: EventType;
  tag: string | null;
}

const CalendarPage = () => {
  const [view, setView] = useState<ViewType>("month");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [smsReminders, setSmsReminders] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    time: "",
    type: "session" as EventType,
    tag: ""
  });

  const formatTime = useCallback((time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }, []);

  const transformDatabaseEvent = useCallback((dbEvent: DatabaseEvent): Event => ({
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description || "",
    date: new Date(dbEvent.event_date),
    time: formatTime(dbEvent.event_time),
    type: dbEvent.event_type,
    tag: dbEvent.tag || ""
  }), [formatTime]);

  const fetchEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (error) throw error;

      const transformedEvents = data?.map(transformDatabaseEvent) || [];
      setEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, [transformDatabaseEvent]);

  const fetchNotificationPreferences = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is fine
        console.error('Error fetching preferences:', error);
        return;
      }

      if (data) {
        setEmailNotif(data.email_notifications);
        setInAppAlerts(data.in_app_alerts);
        setSmsReminders(data.sms_reminders);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchNotificationPreferences();
    
    const eventsSubscription = supabase
      .channel('calendar_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEvent = transformDatabaseEvent(payload.new as DatabaseEvent);
            setEvents(prev => [...prev, newEvent]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedEvent = transformDatabaseEvent(payload.new as DatabaseEvent);
            setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
          } else if (payload.eventType === 'DELETE') {
            setEvents(prev => prev.filter(e => e.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const prefsSubscription = supabase
      .channel('notification_preferences_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notification_preferences'
        },
        (payload) => {
          const prefs = payload.new as { email_notifications: boolean; in_app_alerts: boolean; sms_reminders: boolean };
          setEmailNotif(prefs.email_notifications);
          setInAppAlerts(prefs.in_app_alerts);
          setSmsReminders(prefs.sms_reminders);
        }
      )
      .subscribe();

    return () => {
      eventsSubscription.unsubscribe();
      prefsSubscription.unsubscribe();
    };
  }, [fetchEvents, fetchNotificationPreferences, transformDatabaseEvent]);

  const updateNotificationPreference = async (key: string, value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, try to get existing preferences
      const { data: existing } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('notification_preferences')
          .update({ [key]: value })
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            email_notifications: key === 'email_notifications' ? value : true,
            in_app_alerts: key === 'in_app_alerts' ? value : true,
            sms_reminders: key === 'sms_reminders' ? value : false
          });
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating notification preference:', error);
    }
  };

  const handleAddEvent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [hours, minutes] = newEvent.time.split(':');
      const eventDate = new Date(newEvent.date);
      eventDate.setHours(parseInt(hours), parseInt(minutes));

      const { error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          title: newEvent.title,
          description: newEvent.description,
          event_date: newEvent.date,
          event_time: newEvent.time,
          event_type: newEvent.type,
          tag: newEvent.tag
        });

      if (error) throw error;

      setShowAddEventModal(false);
      setNewEvent({
        title: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        time: "",
        type: "session",
        tag: ""
      });
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case "video": return "bg-blue-500";
      case "course": return "bg-green-500";
      case "session": return "bg-purple-500";
      case "webinar": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case "video":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case "course":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        );
      case "session":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case "webinar":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
    }
  };

  const generateCalendarDays = () => {
    const days = [];
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(today.getFullYear(), today.getMonth(), i));
    }
    
    return days;
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 font-sans">
      {/* Header Section */}
      <div className="mb-8">
        <div className="text-xs font-medium text-gray-500 mb-2 tracking-wide">
          ADMIN PORTAL / SCHEDULE
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Calendar & Schedule
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl">
              Stay aligned with upcoming learning sessions, scheduled content releases, and live academic engagements.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowAddEventModal(true)} className="bg-[#174778] hover:bg-[#0f3a63] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Event
            </Button>
          </div>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">8</div>
          <div className="text-xs text-gray-500 font-medium">Upcoming Sessions</div>
          <div className="text-xs text-gray-400 mt-1">Next 7 days</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">14</div>
          <div className="text-xs text-gray-500 font-medium">Scheduled Video Releases</div>
          <div className="text-xs text-gray-400 mt-1">Queued content</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">3</div>
          <div className="text-xs text-gray-500 font-medium">Enrolled Courses Starting Soon</div>
          <div className="text-xs text-gray-400 mt-1">Within 5 days</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">5</div>
          <div className="text-xs text-gray-500 font-medium">Live Webinars Registered</div>
          <div className="text-xs text-gray-400 mt-1">Don&apos;t miss these</div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Calendar View (70%) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Calendar Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h2>
                <div className="flex gap-2">
                  {(["month", "week", "day"] as ViewType[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        view === v
                          ? "bg-[#174778] text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {generateCalendarDays().map((date, index) => (
                  <div
                    key={index}
                    className={`min-h-[100px] p-2 rounded-lg border border-gray-100 transition-all hover:shadow-sm cursor-pointer ${
                      isToday(date) ? "bg-blue-50 border-blue-200 ring-2 ring-blue-200 ring-opacity-50" : "bg-gray-50"
                    } ${!date ? "opacity-0" : ""}`}
                  >
                    {date && (
                      <>
                        <div className={`text-sm font-medium mb-2 ${isToday(date) ? "text-blue-600" : "text-gray-700"}`}>
                          {date.getDate()}
                        </div>
                        {events
                          .filter((e) => e.date.toDateString() === date.toDateString())
                          .slice(0, 2)
                          .map((event) => (
                            <div
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`text-xs p-1.5 rounded mb-1 cursor-pointer transition-all hover:opacity-80 ${getEventColor(event.type)} text-white truncate`}
                            >
                              {event.title}
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="px-6 pb-6">
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <span className="text-gray-600">Video Release</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span className="text-gray-600">Course Start</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-500"></div>
                  <span className="text-gray-600">Live Session</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-orange-500"></div>
                  <span className="text-gray-600">Webinar</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Upcoming Events Feed (30%) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
            </div>
            <div className="p-4 space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all cursor-pointer bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${getEventColor(event.type)} bg-opacity-10 flex items-center justify-center shrink-0`}>
                      <div className={`${getEventColor(event.type).replace("bg-", "text-")}`}>
                        {getEventIcon(event.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                        {event.title}
                      </h4>
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                        {event.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-600 font-medium">
                          {formatDate(event.date)}, {event.time}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getEventColor(event.type)} bg-opacity-10 ${getEventColor(event.type).replace("bg-", "text-")}`}>
                          {event.tag}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Smart Alerts Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Smart Reminders</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                You have 2 sessions today and 1 webinar tomorrow.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Email Notifications</span>
                  <button
                    onClick={() => {
                      setEmailNotif(!emailNotif);
                      updateNotificationPreference('email_notifications', !emailNotif);
                    }}
                    className={`w-11 h-6 rounded-full transition-all ${
                      emailNotif ? "bg-[#174778]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transition-all ${
                        emailNotif ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">In-app Alerts</span>
                  <button
                    onClick={() => {
                      setInAppAlerts(!inAppAlerts);
                      updateNotificationPreference('in_app_alerts', !inAppAlerts);
                    }}
                    className={`w-11 h-6 rounded-full transition-all ${
                      inAppAlerts ? "bg-[#174778]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transition-all ${
                        inAppAlerts ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">SMS Reminders</span>
                  <button
                    onClick={() => {
                      setSmsReminders(!smsReminders);
                      updateNotificationPreference('sms_reminders', !smsReminders);
                    }}
                    className={`w-11 h-6 rounded-full transition-all ${
                      smsReminders ? "bg-[#174778]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transition-all ${
                        smsReminders ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Insight Card */}
          <div className="bg-gradient-to-br from-[#174778] to-[#0f3a63] rounded-2xl shadow-sm overflow-hidden p-5 text-white">
            <h3 className="text-lg font-semibold mb-2">Engagement Insight</h3>
            <p className="text-sm text-blue-100 mb-4">
              Users who attend scheduled sessions are 35% more likely to complete courses.
            </p>
            <div className="flex items-end gap-2 h-16">
              <div className="flex-1 bg-white bg-opacity-20 rounded-t h-full flex items-end">
                <div className="w-full bg-white bg-opacity-40 h-[60%] rounded-t"></div>
              </div>
              <div className="flex-1 bg-white bg-opacity-20 rounded-t h-full flex items-end">
                <div className="w-full bg-white bg-opacity-40 h-[75%] rounded-t"></div>
              </div>
              <div className="flex-1 bg-white bg-opacity-20 rounded-t h-full flex items-end">
                <div className="w-full bg-white bg-opacity-40 h-[65%] rounded-t"></div>
              </div>
              <div className="flex-1 bg-white bg-opacity-20 rounded-t h-full flex items-end">
                <div className="w-full bg-white bg-opacity-40 h-[85%] rounded-t"></div>
              </div>
              <div className="flex-1 bg-white bg-opacity-20 rounded-t h-full flex items-end">
                <div className="w-full bg-white bg-opacity-40 h-[90%] rounded-t"></div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-blue-100">
              <span>Attendance</span>
              <span>Completion</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add New Event</h3>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent"
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent"
                  rows={3}
                  placeholder="Event description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as EventType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent"
                >
                  <option value="video">Video Release</option>
                  <option value="course">Course Start</option>
                  <option value="session">Live Session</option>
                  <option value="webinar">Webinar</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                <input
                  type="text"
                  value={newEvent.tag}
                  onChange={(e) => setNewEvent({ ...newEvent, tag: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent"
                  placeholder="e.g., Live Session"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowAddEventModal(false)}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEvent}
                  className="flex-1 bg-[#174778] hover:bg-[#0f3a63] text-white"
                >
                  Add Event
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl ${getEventColor(selectedEvent.type)} bg-opacity-10 flex items-center justify-center`}>
                  <div className={`${getEventColor(selectedEvent.type).replace("bg-", "text-")}`}>
                    {getEventIcon(selectedEvent.type)}
                  </div>
                </div>
                <div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getEventColor(selectedEvent.type)} bg-opacity-10 ${getEventColor(selectedEvent.type).replace("bg-", "text-")}`}>
                    {selectedEvent.tag}
                  </span>
                </div>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedEvent.title}</h4>
              <p className="text-sm text-gray-600 mb-4">{selectedEvent.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(selectedEvent.date)}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {selectedEvent.time}
                </div>
              </div>
              <Button className="w-full bg-[#174778] hover:bg-[#0f3a63] text-white py-2.5 rounded-lg text-sm font-medium transition-all">
                {selectedEvent.type === "video" ? "View Now" : "Join Now"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CalendarPage;