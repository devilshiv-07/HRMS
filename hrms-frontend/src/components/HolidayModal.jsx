import { useState } from "react";
import api from "../api/axios";

export default function HolidayModal({ close, refresh, editData }) {
  const [title, setTitle] = useState(editData?.title || "");
  const [date, setDate] = useState(editData ? editData.date.split("T")[0] : "");
  const [description, setDescription] = useState(editData?.description || "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const showMsg = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2000); // auto hide 2 sec
  };

  const handleSubmit = async () => {
    if (!title || !date) return showMsg("Title & Date required");

    try {
      setLoading(true);

      if (editData)
        await api.put(`/holidays/${editData.id}`, { title, date, description });
      else
        await api.post(`/holidays`, { title, date, description });

      showMsg(editData ? "Holiday Updated" : "Holiday Added");
      refresh();

      setTimeout(() => close(), 700); // smooth close after success
    } catch {
      showMsg("Action Failed!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="bg-white dark:bg-gray-900 p-6 w-[400px] rounded-lg shadow-xl border dark:border-gray-700 transition">

        {/* Success Message */}
        {msg && (
          <div className="mb-3 text-sm px-3 py-1 rounded bg-green-600 text-white w-fit animate-fadeIn">
            {msg}
          </div>
        )}

        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">
          {editData ? "Edit Holiday" : "Add Holiday"}
        </h3>

        <div className="flex flex-col gap-3">

          <input
            type="text"
            placeholder="Holiday Title"
            className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 focus:ring-2 ring-blue-500"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
          />

          <input
            type="date"
            className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 focus:ring-2 ring-blue-500"
            value={date}
            onChange={(e)=>setDate(e.target.value)}
          />

          {/* <textarea
            placeholder="Description (optional)"
            className="border p-2 rounded dark:bg-gray-800 dark:border-gray-700 focus:ring-2 ring-blue-500"
            rows={3}
            value={description}
            onChange={(e)=>setDescription(e.target.value)}
          /> */}

          {/* Submit Button with loading state */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`py-2 rounded text-white transition 
              ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}
            `}
          >
            {loading ? "Please Wait..." : (editData ? "Update Holiday" : "Add Holiday")}
          </button>

          <button
            onClick={close}
            disabled={loading}
            className="py-2 rounded bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
