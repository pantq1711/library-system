import React, { useState, useEffect } from 'react';
import socket from '../socket';

const CheckInList = () => {
  const [checkinList, setCheckinList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCheckinList = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/attendance/checkin-list');
      const result = await response.json();
      
      if (result.success) {
        setCheckinList(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Error fetching checkin list:', err);
      setError('Không thể tải danh sách check-in');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckinList();

    socket.on('attendance_update', (data) => {
      console.log('Attendance update received:', data);
      fetchCheckinList(); 
    });

    const interval = setInterval(fetchCheckinList, 30000);

    return () => {
      socket.off('attendance_update');
      clearInterval(interval);
    };
  }, []);

  if (loading) return <div>Đang tải dữ liệu...</div>;
  if (error) return <div>Lỗi: {error}</div>;

  return (
    <div className="checkin-list-container">
      <h3>Danh sách thành viên ra vào thư viện</h3>
      
      <div className="checkin-stats">
        <p>Tổng số lượt: {checkinList.length}</p>
        <p>Đang trong thư viện: {checkinList.filter(c => !c.checkOutTime).length}</p>
      </div>

      <table className="checkin-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Họ tên</th>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Giờ vào</th>
            <th>Giờ ra</th>
            <th>Thời gian</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {checkinList.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center' }}>
                Chưa có thành viên nào check-in hôm nay
              </td>
            </tr>
          ) : (
            checkinList.map((checkin, index) => (
              <tr key={checkin.id}>
                <td>{index + 1}</td>
                <td>{checkin.name}</td>
                <td>{checkin.email}</td>
                <td>
                  {checkin.role === 'member' ? 'Thành viên' :
                   checkin.role === 'librarian' ? 'Thủ thư' : 'Quản trị'}
                </td>
                <td>{new Date(checkin.checkInTime).toLocaleTimeString('vi-VN')}</td>
                <td>
                  {checkin.checkOutTime ? 
                    new Date(checkin.checkOutTime).toLocaleTimeString('vi-VN') : 
                    '-'}
                </td>
                <td>{checkin.duration}</td>
                <td>
                  <span className={`status ${checkin.checkOutTime ? 'checked-out' : 'in-library'}`}>
                    {checkin.checkOutTime ? 'Đã ra' : 'Trong thư viện'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <style jsx>{`
        .checkin-list-container {
          margin: 20px 0;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .checkin-stats {
          display: flex;
          gap: 30px;
          margin: 15px 0;
          font-size: 14px;
          color: #666;
        }

        .checkin-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        .checkin-table th {
          background-color: #28a745;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 500;
        }

        .checkin-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #eee;
        }

        .checkin-table tr:hover {
          background-color: #f8f9fa;
        }

        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .status.in-library {
          background-color: #d4edda;
          color: #155724;
        }

        .status.checked-out {
          background-color: #e9ecef;
          color: #495057;
        }
      `}</style>
    </div>
  );
};

export default CheckInList;
