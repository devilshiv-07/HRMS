import React, { useState, useRef, useEffect } from "react";

export default function EmployeeDropdown({ employees = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 🔥 FIND SELECTED EMPLOYEE BY ID
  const selectedEmp = employees.find((e) => e.id === value);

  const filtered = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={wrapperRef}>
      {/* INPUT — SHOW NAME BUT HOLD ID */}
      <input
        type="text"
        readOnly
        value={
          selectedEmp
            ? `${selectedEmp.firstName} ${selectedEmp.lastName}`
            : ""
        }
        placeholder="Select employee..."
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        className="p-3 w-full rounded-xl border dark:bg-gray-900 shadow cursor-pointer"
      />

      {/* DROPDOWN */}
      {open && (
        <div
          className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-gray-900
                     border shadow-xl rounded-xl max-h-[180px] overflow-y-auto z-[9999]"
        >
          {/* SEARCH */}
          <div className="p-2 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
            <input
              placeholder="Search employees..."
              className="p-2 w-full rounded-md border dark:bg-gray-800"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* LIST */}
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No employees found</div>
          ) : (
            filtered.map((emp) => {
              const full = `${emp.firstName} ${emp.lastName}`;

              return (
                <div
                  key={emp.id}
                  className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
                  onClick={() => {
                    onChange(emp.id);   // ✅ SEND ID ONLY
                    setOpen(false);
                  }}
                >
                  {full} ({emp.role})
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
