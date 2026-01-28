import React, { useState, useEffect, useCallback } from "react";
import { FiBell } from "react-icons/fi";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";
import { useSocket } from "../contexts/SocketContext";
import { useNavigate } from "react-router-dom";

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const user = useAuthStore((s) => s.user);
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const loadNotes = useCallback(async () => {
    try {
      const r = await api.get("/notifications");
      let all = r.data.notifications || [];

      // ---------------------------
      // 1️⃣ ADMIN sees ALL notifications (no unread count)
      // ---------------------------
      if (user?.role === "ADMIN") {
        // Deduplicate leave-request notifications so one leave = one row
        const seen = new Set();
        const deduped = [];

        for (const n of all) {
          const metaType = n.meta?.type;
          const leaveId = n.meta?.leaveId;

          if (metaType === "leave_request" && leaveId) {
            const key = `leave_request:${leaveId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(n);
          } else {
            deduped.push(n);
          }
        }

        setNotes(deduped);
        // Admin does not have per-notification "read" state
        setUnreadCount(0);
        return;
      }

      // ---------------------------
      // 2️⃣ EMPLOYEE sees only their own notifications
      // ---------------------------
      const filtered = all.filter((n) => n.userId === user?.id);

      setNotes(filtered);
      // Count unread for employee: based only on readByIds
      const unreadForUser = filtered.filter(
        (n) => !(n.readByIds && n.readByIds.includes(user?.id))
      );
      setUnreadCount(unreadForUser.length);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      loadNotes();
    }
  }, [user?.id, user?.role, loadNotes]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;

    // Listen for new leave request (for admins/managers)
    const handleNewLeaveRequest = () => {
      // Reload notifications to get the latest from database
      loadNotes();
    };

    // Listen for leave status update (for employees)
    const handleLeaveStatusUpdate = () => {
      // Reload notifications to get the latest from database
      loadNotes();
    };

    // Listen for generic notifications (admin / manager created)
    const handleGenericNotification = () => {
      loadNotes();
    };

    socket.on("new_leave_request", handleNewLeaveRequest);
    socket.on("leave_status_update", handleLeaveStatusUpdate);
    socket.on("notification_created", handleGenericNotification);

    return () => {
      if (socket) {
        socket.off("new_leave_request", handleNewLeaveRequest);
        socket.off("leave_status_update", handleLeaveStatusUpdate);
        socket.off("notification_created", handleGenericNotification);
      }
    };
  }, [socket, isConnected, user?.id, loadNotes]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 relative"
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-3 z-50">
          <h4 className="font-semibold mb-2">Notifications</h4>

          <div className="max-h-56 overflow-auto space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm text-gray-500">No notifications</p>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={async () => {
                    // 1️⃣ For employees → optimistically mark as read and update badge
                    if (user?.role !== "ADMIN" && user?.id) {
                      const alreadyRead =
                        n.readByIds && n.readByIds.includes(user.id);

                      if (!alreadyRead) {
                        // Optimistic local update
                        setNotes((prev) => {
                          const updated = prev.map((item) =>
                            item.id === n.id
                              ? {
                                  ...item,
                                  readByIds: [
                                    ...(item.readByIds || []),
                                    user.id,
                                  ],
                                }
                              : item
                          );

                          const unreadForUser = updated.filter(
                            (item) =>
                              !(
                                item.readByIds &&
                                item.readByIds.includes(user.id)
                              )
                          );
                          setUnreadCount(unreadForUser.length);

                          return updated;
                        });

                        // Fire API in background; if it fails, reload from server
                        try {
                          await api.patch(`/notifications/${n.id}/read`);
                        } catch (error) {
                          console.error("Failed to mark notification read:", error);
                          // Fallback: reload from backend to correct state
                          loadNotes();
                        }
                      }
                    }

                    // 2️⃣ Navigation logic
                    const metaType = n.meta?.type;
                    const leaveId = n.meta?.leaveId;

                    // If this is a leave request notification with leaveId → jump to specific leave
                    if (metaType === "leave_request" && leaveId) {
                      navigate(`/leaves?leaveId=${leaveId}`);
                      setOpen(false);
                      return;
                    }

                    // Fallback: go to full notifications page
                    navigate("/notifications");
                    setOpen(false);
                  }}
                >
                  <div className="text-sm font-bold">{n.title}</div>
                  <div className="text-xs text-gray-400">{n.body}</div>

                  <div className="text-[10px] text-gray-500 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
