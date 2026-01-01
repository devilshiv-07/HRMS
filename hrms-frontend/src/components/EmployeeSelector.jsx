import { useState, useRef, useEffect } from "react";

export default function EmployeeSelector({ users, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = users.filter((u) =>
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-full p-2 border rounded dark:bg-gray-900 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {value
          ? users.find((x) => x.id === value)?.firstName +
            " " +
            users.find((x) => x.id === value)?.lastName
          : "Select Employee"}
      </div>

      {open && (
        <div
          className="absolute w-full bg-white dark:bg-gray-800 rounded shadow border
                     mt-1 z-50 p-2"
        >
          {/* Search bar */}
          <input
            className="w-full p-2 border rounded mb-2 dark:bg-gray-900"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* List max 5 visible */}
          <div
            className="max-h-44 overflow-y-auto"   // max-height ~ 5 items
            style={{ scrollbarWidth: "thin" }}
          >
            {filtered.length === 0 && (
              <div className="p-2 text-gray-400 text-sm">No match found</div>
            )}

            {filtered.map((u) => (
              <div
                key={u.id}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                onClick={() => {
                  onChange(u.id);
                  setOpen(false);
                }}
              >
                {u.firstName} {u.lastName}{" "}
                <span className="text-xs text-gray-500">({u.role})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
