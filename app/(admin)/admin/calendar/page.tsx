// "use client";

// import { useEffect, useState } from "react";
// import { supabase } from "@/app/lib/supabase";

// type Profile = {
//     id: string;
//     full_name: string | null;
//     email?: string;
// };

// type CalendarEvent = {
//     id: string;
//     title: string;
//     description: string;
//     event_date: string;
//     event_time: string;
//     event_type: string;
//     tag: string;
//     user_id: string;
// };

// export default function AdminCalendarPage() {
//     const [users, setUsers] = useState<Profile[]>([]);
//     const [events, setEvents] = useState<CalendarEvent[]>([]);

//     const [selectedUser, setSelectedUser] = useState("");
//     const [title, setTitle] = useState("");
//     const [description, setDescription] = useState("");
//     const [eventDate, setEventDate] = useState("");
//     const [eventTime, setEventTime] = useState("");
//     const [eventType, setEventType] = useState("webinar");
//     const [tag, setTag] = useState("");

//     const fetchUsers = async () => {
//         const { data } = await supabase
//             .from("profiles")
//             .select("id, full_name");

//         if (data) setUsers(data);
//     };

//     const fetchEvents = async () => {
//         const { data } = await supabase
//             .from("calendar_events")
//             .select("*")
//             .order("event_date", { ascending: true });

//         if (data) setEvents(data);
//     };

//     useEffect(() => {
//         fetchUsers();
//         fetchEvents();

//         const channel = supabase
//             .channel("calendar-realtime-admin")
//             .on(
//                 "postgres_changes",
//                 {
//                     event: "*",
//                     schema: "public",
//                     table: "calendar_events",
//                 },
//                 () => {
//                     fetchEvents();
//                 }
//             )
//             .subscribe();

//         return () => {
//             supabase.removeChannel(channel);
//         };
//     }, []);

//     const handleCreateEvent = async () => {
//         if (
//             !selectedUser ||
//             !title ||
//             !eventDate ||
//             !eventTime
//         ) {
//             alert("Please fill all required fields");
//             return;
//         }

//         const { error } = await supabase
//             .from("calendar_events")
//             .insert([
//                 {
//                     user_id: selectedUser,
//                     title,
//                     description,
//                     event_date: eventDate,
//                     event_time: eventTime,
//                     event_type: eventType,
//                     tag,
//                 },
//             ]);

//         if (error) {
//             alert(error.message);
//             return;
//         }

//         setTitle("");
//         setDescription("");
//         setEventDate("");
//         setEventTime("");
//         setTag("");

//         fetchEvents();
//     };

//     const handleDelete = async (id: string) => {
//         const confirmed = confirm(
//             "Are you sure you want to delete this event?"
//         );

//         if (!confirmed) return;

//         const { error } = await supabase
//             .from("calendar_events")
//             .delete()
//             .eq("id", id);

//         if (error) {
//             alert(error.message);
//             return;
//         }

//         fetchEvents();
//     };

//     return (
//         <div className="p-6">
//             <h1 className="text-2xl font-bold mb-6">
//                 Admin Calendar Management
//             </h1>

//             <div className="bg-black border rounded-xl p-6 mb-8 space-y-4">

//                 <select
//                     value={selectedUser}
//                     onChange={(e) => setSelectedUser(e.target.value)}
//                     className="w-full border rounded-lg p-2"
//                 >
//                     <option value="">Select User</option>

//                     {users.map((user) => (
//                         <option key={user.id} value={user.id}>
//                             {user.full_name || user.id}
//                         </option>
//                     ))}
//                 </select>

//                 <input
//                     type="text"
//                     placeholder="Event title"
//                     value={title}
//                     onChange={(e) => setTitle(e.target.value)}
//                     className="w-full border rounded-lg p-2"
//                 />

//                 <textarea
//                     placeholder="Description"
//                     value={description}
//                     onChange={(e) => setDescription(e.target.value)}
//                     className="w-full border rounded-lg p-2"
//                 />

//                 <div className="grid grid-cols-2 gap-4">

//                     <input
//                         type="date"
//                         value={eventDate}
//                         onChange={(e) => setEventDate(e.target.value)}
//                         className="border rounded-lg p-2"
//                     />

//                     <input
//                         type="time"
//                         value={eventTime}
//                         onChange={(e) => setEventTime(e.target.value)}
//                         className="border rounded-lg p-2"
//                     />
//                 </div>

//                 <select
//                     value={eventType}
//                     onChange={(e) => setEventType(e.target.value)}
//                     className="w-full border rounded-lg p-2"
//                 >
//                     <option value="video">Video</option>
//                     <option value="course">Course</option>
//                     <option value="session">Session</option>
//                     <option value="webinar">Webinar</option>
//                 </select>

//                 <input
//                     type="text"
//                     placeholder="Tag"
//                     value={tag}
//                     onChange={(e) => setTag(e.target.value)}
//                     className="w-full border rounded-lg p-2"
//                 />

//                 <button
//                     onClick={handleCreateEvent}
//                     className="bg-[#0B1E6D] text-white px-4 py-2 rounded-lg"
//                 >
//                     Create Event
//                 </button>
//             </div>

//             <div className="space-y-4">

//                 {events.map((event) => (
//                     <div
//                         key={event.id}
//                         className="border rounded-xl p-4 bg-black"
//                     >
//                         <div className="flex justify-between items-start">

//                             <div>
//                                 <h2 className="font-semibold text-lg">
//                                     {event.title}
//                                 </h2>

//                                 <p className="text-sm text-gray-500">
//                                     {event.description}
//                                 </p>

//                                 <div className="mt-2 text-sm">
//                                     <p>Date: {event.event_date}</p>
//                                     <p>Time: {event.event_time}</p>
//                                     <p>Type: {event.event_type}</p>
//                                     <p>Tag: {event.tag}</p>
//                                 </div>
//                             </div>

//                             <button
//                                 onClick={() => handleDelete(event.id)}
//                                 className="text-red-500 font-medium"
//                             >
//                                 Delete
//                             </button>
//                         </div>
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// }

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import {
  Calendar as CalendarIcon,
  Clock,
  Tag,
  User,
  Trash2,
  CalendarPlus,
  FileText,
  LayoutTemplate,
} from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  email?: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  event_type: string;
  tag: string;
  user_id: string;
};

export default function AdminCalendarPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [selectedUser, setSelectedUser] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventType, setEventType] = useState("webinar");
  const [tag, setTag] = useState("");

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name");

    if (data) setUsers(data);
  };

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .order("event_date", { ascending: true });

    if (data) setEvents(data);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
    fetchEvents();

    const channel = supabase
      .channel("calendar-realtime-admin")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_events",
        },
        () => {
          fetchEvents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateEvent = async () => {
    if (!selectedUser || !title || !eventDate || !eventTime) {
      alert("Please fill all required fields");
      return;
    }

    const { error } = await supabase.from("calendar_events").insert([
      {
        user_id: selectedUser,
        title,
        description,
        event_date: eventDate,
        event_time: eventTime,
        event_type: eventType,
        tag,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    setEventDate("");
    setEventTime("");
    setTag("");

    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    const confirmed = confirm("Are you sure you want to delete this event?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchEvents();
  };

  // Helper to style badges based on event type
  const getBadgeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case "webinar":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "course":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "session":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "video":
        return "bg-orange-50 text-orange-700 border-orange-100";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#174778] tracking-tight">
            Calendar Management
          </h1>
          <p className="text-gray-500 mt-1">
            Schedule masterclasses, webinars, and curations for scholars.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: CREATE EVENT FORM */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-6">
              <CalendarPlus className="text-[#174778]" size={22} />
              <h2 className="text-lg font-bold text-[#0f172a]">
                Create New Event
              </h2>
            </div>

            <div className="space-y-5">
              {/* User Select */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User size={14} /> Assign Scholar
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Select User --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <LayoutTemplate size={14} /> Event Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advanced Epistemology"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={14} /> Description
                </label>
                <textarea
                  placeholder="Brief details about the event..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all resize-y"
                />
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarIcon size={14} /> Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock size={14} /> Time
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all"
                  />
                </div>
              </div>

              {/* Event Type */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all appearance-none cursor-pointer"
                >
                  <option value="video">Video</option>
                  <option value="course">Course</option>
                  <option value="session">Session</option>
                  <option value="webinar">Webinar</option>
                </select>
              </div>

              {/* Tag */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag size={14} /> Custom Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mandatory, Optional"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleCreateEvent}
                className="w-full bg-[#174778] hover:bg-[#113a63] text-white py-3.5 rounded-lg text-sm font-semibold transition-all shadow-sm mt-2"
              >
                Schedule Event
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: EVENT TIMELINE */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-[#0f172a]">
                Scheduled Events
              </h2>
              <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">
                {events.length} Total
              </span>
            </div>

            {events.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon size={32} />
                </div>
                <h3 className="text-gray-900 font-bold">No events scheduled</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Use the form to create a new calendar event.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full"
                  >
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getBadgeStyle(event.event_type)}`}
                        >
                          {event.event_type}
                        </span>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h3 className="font-bold text-[#0f172a] text-[17px] leading-tight mb-2">
                        {event.title}
                      </h3>

                      <p className="text-sm text-gray-500 line-clamp-2">
                        {event.description || "No description provided."}
                      </p>
                    </div>

                    <div className="bg-gray-50/50 px-5 py-4 border-t border-gray-50 grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                        <CalendarIcon size={14} className="text-gray-400" />
                        {event.event_date}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                        <Clock size={14} className="text-gray-400" />
                        {event.event_time}
                      </div>
                      {event.tag && (
                        <div className="col-span-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                          <Tag size={14} className="text-gray-400" />
                          {event.tag}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
