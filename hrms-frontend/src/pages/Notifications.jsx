// ===================== NOTIFICATIONS — FINAL PROFESSIONAL UI (UPDATED) =====================
import React, { useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";

/* ========================================================
      🔍 SEARCHABLE DROPDOWN (scroll + search + dark mode)
======================================================== */
function SearchableDropdown({ users, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = users.filter((u) =>
    `${u.firstName} ${u.lastName}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full">
      {/* Selected */}
      <div
        onClick={() => setOpen(!open)}
        className="input-sm cursor-pointer select-none"
      >
        {value
          ? users.find((u) => u.id === value)?.firstName +
            " " +
            users.find((u) => u.id === value)?.lastName
          : "Select Employee"}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 z-50">

          {/* Search Box */}
          <input
            type="text"
            placeholder="Search…"
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 dark:text-white border-b border-gray-300 dark:border-gray-600 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* List */}
          <div className="max-h-40 overflow-y-auto custom-scroll">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                No match found
              </div>
            )}

            {filtered.map((u) => (
              <div
                key={u.id}
                onClick={() => {
                  onChange(u.id);
                  setOpen(false);
                  setSearch("");
                }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500"
              >
                {u.firstName} {u.lastName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================
                      MAIN COMPONENT
======================================================== */
export default function Notifications() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user.role === "ADMIN";

  const [notes, setNotes] = useState([]);
  const [users, setUsers] = useState([]);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  const todayIso = new Date().toISOString().slice(0, 10);

  const [filter, setFilter] = useState({
    start: todayIso,
    end: todayIso,
    search: "",
    type: "ALL",
  });

  const [form, setForm] = useState({
    userId: "",
    title: "",
    body: "",
    notifyAll: false,
  });

  /* MSG AUTO HIDE */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg]);

  /* LOAD */
  const load = async () => {
    try {
      const q = new URLSearchParams(filter).toString();
      const r = await api.get(`/notifications?${q}`);
      setNotes(r.data.notifications || []);
    } catch {
      setMsg("Failed to load notifications");
      setMsgType("error");
    }
  };

  useEffect(() => {
    load();
    if (isAdmin)
      api.get("/users").then((r) => setUsers(r.data.users || []));
  }, [filter]);

  /* SEND NOTIFICATION */
  const sendNotification = async () => {
    try {
      if (!form.notifyAll && !form.userId)
        return setError("Select employee or enable notify all");

      if (!form.title.trim()) return setError("Title required");

      await api.post("/notifications", form);
      setSuccess("Notification sent");

      setForm({ userId: "", title: "", body: "", notifyAll: false });
      load();
    } catch {
      setError("Send failed");
    }
  };

  const setError = (m) => {
    setMsgType("error");
    setMsg(m);
  };

  const setSuccess = (m) => {
    setMsgType("success");
    setMsg(m);
  };

  /* MARK READ */
  const markRead = async (id) => {
    if (isAdmin) return;
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  /* DELETE */
  const del = async (id) => {
    await api.delete(`/notifications/${id}`);
    setSuccess("Deleted");
    load();
  };

  /* MERGED ADMIN VIEW */
  const mergedForAdmin = useMemo(() => {
    if (!isAdmin) return notes;

    const map = new Map();

    notes.forEach((n) => {
      const key = n.title + "::" + n.body + "::" + n.createdAt;

      if (!map.has(key)) {
        map.set(key, {
          ...n,
          deliveredTo: [],
          readByNames: [],
        });
      }

      const entry = map.get(key);
      entry.deliveredTo.push(n);

      if (n.readBy?.length > 0) {
        n.readBy.forEach((u) => {
          if (!entry.readByNames.find((x) => x.id === u.id)) {
            entry.readByNames.push(u);
          }
        });
      }
    });

    return Array.from(map.values());
  }, [notes, isAdmin]);

  const finalList = isAdmin ? mergedForAdmin : notes;

  /* SEARCH + READ FILTERS */
  const list = finalList.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(filter.search.toLowerCase()) ||
      n.body.toLowerCase().includes(filter.search.toLowerCase());

    // Admin has no personal read state; READ/UNREAD filters don't apply
    if (isAdmin) return matchesSearch;

    const hasUserId = !!user?.id;
    const isReadForUser =
      hasUserId && n.readByIds && n.readByIds.includes(user.id);

    if (filter.type === "READ") return isReadForUser && matchesSearch;
    if (filter.type === "UNREAD") return !isReadForUser && matchesSearch;

    // ALL
    return matchesSearch;
  });

  return (
    <div className="space-y-6">

      {/* STATUS MESSAGE */}
      {msg && (
        <div
          className={`p-3 rounded-lg text-sm ${
            msgType === "success"
              ? "bg-green-100 text-green-700 border border-green-300"
              : "bg-red-100 text-red-700 border border-red-300"
          }`}
        >
          {msg}
        </div>
      )}

      <PageTitle title="Notifications" sub="All alerts & announcements" />

      {/* SEND PANEL */}
      {isAdmin && (
        <GlassCard>
          <h3 className="text-lg font-semibold mb-2">Send Notification</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {!form.notifyAll && (
              <SearchableDropdown
                users={users}
                value={form.userId}
                onChange={(id) => setForm({ ...form, userId: id })}
              />
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notifyAll}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notifyAll: e.target.checked,
                    userId: "",
                  })
                }
              />
              Notify all employees
            </label>
          <input
            className="input-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <textarea
            className="input-sm md:col-span-2 w-full"
            placeholder="Message"
            rows={2}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <button className="btn-primary mt-3" onClick={sendNotification}>
          Send
        </button>
      </GlassCard>
    )}

    {/* ========================= FILTER BAR ========================= */}
    <GlassCard>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

        <input
          type="text"
          placeholder="Search…"
          className="input-sm w-full md:w-1/3"
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
        />

        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={filter.start}
            onChange={(e) => setFilter({ ...filter, start: e.target.value })}
            className="input-sm w-28"
          />
          →
          <input
            type="date"
            value={filter.end}
            onChange={(e) => setFilter({ ...filter, end: e.target.value })}
            className="input-sm w-28"
          />
        </div>

        <div className="flex gap-2 text-xs font-medium">
          {["ALL", "UNREAD", "READ"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter({ ...filter, type: t })}
              className={`px-3 py-1 rounded-md ${
                filter.type === t
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

      </div>
    </GlassCard>

    {/* ========================= NOTIFICATION LIST ========================= */}
    <GlassCard>
      <h3 className="text-lg font-semibold mb-2">Notifications</h3>

      {list.length === 0 && (
        <p className="text-gray-500 text-sm">No notifications found.</p>
      )}

      <div className="divide-y divide-gray-200 dark:divide-gray-800">

        {list.map((n) => (
          <div
            key={n.id}
            className="flex justify-between items-start p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            {/* LEFT SIDE */}
            <div className="flex gap-2">

              {/* unread dot */}
              {!isAdmin && user?.id && (!n.readByIds || !n.readByIds.includes(user.id)) && (
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              )}

              <div>
                <div className="font-semibold text-sm dark:text-white">
                  {n.title}
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">
                  {n.body}
                </div>

                <div className="text-[10px] text-gray-500 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>

                {/* ADMIN READ INFO */}
                {isAdmin && (
                  <div className="text-[11px] mt-1 text-blue-400 cursor-pointer">

                    Delivered to: {n.deliveredTo?.length || 1}  
                    <br />
                    Read by: {n.readByNames?.length || 0}

                    {n.readByNames?.length > 0 && (
                      <div className="bg-black text-white p-2 rounded mt-1 text-[10px] shadow-lg">
                        {n.readByNames.map((u) => (
                          <div key={u.id}>• {u.firstName} {u.lastName}</div>
                        ))}
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

            {/* RIGHT BUTTONS */}
                {!isAdmin && user?.id && (!n.readByIds || !n.readByIds.includes(user.id)) && (
              <div className="flex flex-col gap-1 ml-2">
                  <button
                    className="btn-small bg-blue-600"
                    onClick={() => markRead(n.id)}
                  >
                    Read
                  </button>

                <button
                  className="btn-small bg-red-600"
                  onClick={() => del(n.id)}
                >
                  Del
                </button>
              </div>
            )}
          </div>
        ))}

      </div>
    </GlassCard>

    {/* ========================= STYLES ========================= */}
    <style>{`
      .input-sm {
        padding: 8px;
        border-radius: 8px;
        border: 1px solid #ddd;
        background: #f8f9fb;
        width: 100%;
        font-size: 13px;
      }
      .dark .input-sm {
        background: #111827;
        border-color: #374151;
        color: white;
      }

      .btn-primary {
        padding: 8px 16px;
        background: #4f46e5;
        color: white;
        border-radius: 8px;
        font-size: 13px;
      }

      .btn-small {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 10px;
        color: white;
      }

      .line-clamp-1 {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .custom-scroll::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scroll::-webkit-scrollbar-thumb {
        background: #a5a5a5;
        border-radius: 5px;
      }
    `}</style>
  </div>
  );
}

/* ========================= COMMON COMPONENTS ========================= */
function PageTitle({ title, sub }) {
  return (
    <div className="mb-1">
      <h1 className="text-2xl font-bold dark:text-white">{title}</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{sub}</p>
    </div>
  );
}

function GlassCard({ children }) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow">
      {children}
    </div>
  );
}
