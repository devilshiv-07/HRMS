import { useEffect, useState } from "react";
import api from "../api/axios";
import HolidayModal from "../components/HolidayModal";
import ConfirmDelPopup from "../components/ConfirmDelPopup";
import { FiEdit2, FiTrash, FiPlus } from "react-icons/fi";

export default function HolidayPage() {
  const [holidays, setHolidays] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [confirmDel, setConfirmDel] = useState({ show:false, id:null });
  const [message, setMessage] = useState(null);
  const [loadingDelete, setLoadingDelete] = useState(false);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2000);     // ⏳ 2 sec auto remove
  };

  const fetchHolidays = async () => {
    const res = await api.get("/holidays");
    setHolidays(res.data.holidays);
  };

  useEffect(() => { fetchHolidays(); }, []);

  const deleteHoliday = async () => {
    try {
      setLoadingDelete(true);
      await api.delete(`/holidays/${confirmDel.id}`);
      showMessage("Holiday Deleted Successfully");
      fetchHolidays();
    } catch {
      showMessage("Failed to delete");
    } finally {
      setLoadingDelete(false);
      setConfirmDel({ show:false, id:null });
    }
  };

  return (
    <div className="p-6 w-full text-gray-900 dark:text-gray-100">

      {/* 🔥 Message Alert */}
      {message && (
        <div className="mb-3 text-sm px-4 py-2 rounded-md bg-green-600 text-white w-fit animate-fadeIn">
          {message}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Holiday Management</h2>

        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded flex items-center gap-2"
          onClick={() => { setEditData(null); setOpenModal(true); }}
        >
          <FiPlus /> Add Holiday
        </button>
      </div>

      <table className="w-full border rounded dark:border-gray-700">
        <thead className="bg-gray-200 dark:bg-gray-800">
          <tr>
            <th className="p-2 border text-left dark:border-gray-700">Date</th>
            <th className="p-2 border text-left dark:border-gray-700">Day</th>
            <th className="p-2 border text-left dark:border-gray-700">Title</th>
            <th className="p-2 border text-left dark:border-gray-700 w-[130px]">Actions</th>
          </tr>
        </thead>

        <tbody>
          {holidays.length > 0 ? holidays.map(h => (
            <tr key={h.id} className="border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="p-2 border dark:border-gray-700">
                {new Date(h.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
              </td>
              <td className="p-2 border dark:border-gray-700 font-semibold text-blue-600 dark:text-blue-400">{h.day}</td>
              <td className="p-2 border dark:border-gray-700">{h.title}</td>

              <td className="p-2 border flex gap-3 dark:border-gray-700">
                <button onClick={() => { setEditData(h); setOpenModal(true); }}>
                  <FiEdit2 className="text-indigo-600 scale-100 hover:scale-110 transition cursor-pointer"/>
                </button>

                <button onClick={() => setConfirmDel({show:true, id:h.id})}>
                  <FiTrash className="text-red-600 scale-100 hover:scale-110 transition cursor-pointer"/>
                </button>
              </td>
            </tr>
          )) :
            <tr><td colSpan="4" className="text-center text-gray-500 dark:text-gray-400 py-4">No holidays found</td></tr>
          }
        </tbody>
      </table>

      {openModal && (
        <HolidayModal close={() => setOpenModal(false)} refresh={fetchHolidays} editData={editData} />
      )}

      {confirmDel.show && (
        <ConfirmDelPopup
          title="Delete Holiday?"
          message="This action cannot be undone."
          onCancel={() => setConfirmDel({show:false,id:null})}
          onConfirm={deleteHoliday}
        />
      )}
    </div>
  );
}
