import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, collection, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, query } from 'firebase/firestore';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, LayoutDashboard, ListTodo, Wallet, Users, Mail, Store, Settings, Plus, X, Trash2, Edit, Check, AlertTriangle, PartyPopper, FilePlus2 } from 'lucide-react';

// --- CẤU HÌNH FIREBASE ---
// Lưu ý: Các biến __firebase_config và __app_id sẽ được cung cấp trong môi trường thực thi.
// Khi chạy cục bộ, bạn cần thay thế chúng bằng cấu hình Firebase của riêng bạn.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-wedding-planner';

// --- KHỞI TẠO FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Vẫn cần auth để tương tác với các quy tắc bảo mật của Firestore nếu có
const db = getFirestore(app);

// --- CÁC HẰNG SỐ & DỮ LIỆU MẪU ---
const CATEGORIES = {
    NHAN_CUOI: 'Nhẫn cưới',
    DIA_DIEM: 'Địa điểm',
    TRANG_PHUC: 'Trang phục',
    TRANG_TRI: 'Trang trí',
    AM_THUC: 'Ẩm thực',
    CHUP_ANH: 'Chụp ảnh & Quay phim',
    THIEP_MOI: 'Thiệp mời',
    KHACH_MOI: 'Khách mời',
    NGAN_SACH: 'Ngân sách',
    VENDOR: 'Nhà cung cấp',
    QUA_TANG: 'Quà tặng khách',
    PHAT_SINH: 'Chi phí phát sinh',
};

const TASK_PRIORITIES = {
    CAO: 'Cao',
    TRUNG_BINH: 'Trung bình',
    THAP: 'Thấp',
};

const VENDOR_STATUSES = {
    TIEM_NANG: 'Tiềm năng',
    DA_DAT: 'Đã đặt cọc',
    XAC_NHAN: 'Đã xác nhận',
};

const GUEST_RSVP = {
    CHUA_TRA_LOI: 'Chưa trả lời',
    THAM_GIA: 'Tham gia',
    TU_CHOI: 'Từ chối',
};

// Hàm tạo timeline công việc mặc định
const getDefaultTasks = (weddingDate) => {
    const wDate = new Date(weddingDate);
    const tasks = [
        { name: 'Chốt danh sách khách mời sơ bộ', category: CATEGORIES.KHACH_MOI, daysBefore: 180, priority: TASK_PRIORITIES.CAO, cost: 0 },
        { name: 'Xác định ngân sách tổng thể', category: CATEGORIES.NGAN_SACH, daysBefore: 175, priority: TASK_PRIORITIES.CAO, cost: 0 },
        { name: 'Chọn và đặt cọc địa điểm tổ chức tiệc', category: CATEGORIES.DIA_DIEM, daysBefore: 150, priority: TASK_PRIORITIES.CAO, cost: 50000000 },
        { name: 'Chọn và đặt cọc nhiếp ảnh gia, quay phim', category: CATEGORIES.CHUP_ANH, daysBefore: 140, priority: TASK_PRIORITIES.CAO, cost: 20000000 },
        { name: 'Chọn và mua nhẫn cưới', category: CATEGORIES.NHAN_CUOI, daysBefore: 120, priority: TASK_PRIORITIES.CAO, cost: 15000000 },
        { name: 'Bắt đầu tìm kiếm và thử váy cưới, vest', category: CATEGORIES.TRANG_PHUC, daysBefore: 110, priority: TASK_PRIORITIES.TRUNG_BINH, cost: 0 },
        { name: 'Đặt cọc trang phục cưới', category: CATEGORIES.TRANG_PHUC, daysBefore: 90, priority: TASK_PRIORITIES.CAO, cost: 10000000 },
        { name: 'Lên ý tưởng và đặt cọc đội trang trí', category: CATEGORIES.TRANG_TRI, daysBefore: 80, priority: TASK_PRIORITIES.CAO, cost: 15000000 },
        { name: 'Thiết kế và đặt in thiệp mời', category: CATEGORIES.THIEP_MOI, daysBefore: 70, priority: TASK_PRIORITIES.TRUNG_BINH, cost: 3000000 },
        { name: 'Chốt thực đơn với nhà hàng', category: CATEGORIES.AM_THUC, daysBefore: 60, priority: TASK_PRIORITIES.CAO, cost: 80000000 },
        { name: 'Gửi thiệp mời', category: CATEGORIES.THIEP_MOI, daysBefore: 45, priority: TASK_PRIORITIES.CAO, cost: 500000 },
        { name: 'Xác nhận lại RSVP từ khách mời', category: CATEGORIES.KHACH_MOI, daysBefore: 20, priority: TASK_PRIORITIES.CAO, cost: 0 },
        { name: 'Sơ đồ chỗ ngồi cho khách', category: CATEGORIES.KHACH_MOI, daysBefore: 15, priority: TASK_PRIORITIES.TRUNG_BINH, cost: 0 },
        { name: 'Thử lại trang phục cưới lần cuối', category: CATEGORIES.TRANG_PHUC, daysBefore: 10, priority: TASK_PRIORITIES.CAO, cost: 0 },
        { name: 'Xác nhận lại tất cả các nhà cung cấp', category: CATEGORIES.VENDOR, daysBefore: 7, priority: TASK_PRIORITIES.CAO, cost: 0 },
    ];

    return tasks.map(task => ({
        ...task,
        dueDate: new Date(wDate.getTime() - task.daysBefore * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completed: false
    }));
};


// --- COMPONENT CON ---

const Spinner = () => (
    <div className="flex justify-center items-center h-full w-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-pink-400"></div>
    </div>
);

const EmptyState = ({ icon, title, message, children }) => (
    <div className="text-center p-8 bg-white/50 backdrop-blur-lg rounded-2xl border border-white/20">
        <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-pink-100 text-pink-500">
            {icon}
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-800">{title}</h3>
        <p className="mt-1 text-sm text-gray-600">{message}</p>
        <div className="mt-6">
            {children}
        </div>
    </div>
);


const Modal = ({ children, isOpen, onClose, title }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-white/50 backdrop-blur-xl rounded-2xl shadow-lg w-full max-w-lg overflow-hidden border border-white/20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center p-4 border-b border-white/20">
                            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                            <button onClick={onClose} className="text-gray-600 hover:text-gray-900 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// --- CÁC COMPONENT CHỨC NĂNG ---

const Dashboard = ({ tasks, budget, guests, vendors, settings, onNavigate, userId }) => {
    const totalSpent = useMemo(() => tasks.reduce((sum, task) => sum + (Number(task.cost) || 0), 0), [tasks]);
    const budgetRemaining = (settings.totalBudget || 200000000) - totalSpent;
    
    const completedTasks = useMemo(() => tasks.filter(task => task.completed).length, [tasks]);
    const guestsAttending = useMemo(() => guests.filter(g => g.rsvpStatus === GUEST_RSVP.THAM_GIA).length, [guests]);

    const budgetData = [
        { name: 'Đã chi', value: totalSpent },
        { name: 'Còn lại', value: budgetRemaining > 0 ? budgetRemaining : 0 },
    ];
    const COLORS = ['#FF8042', '#00C49F'];

    const spendingByCategory = useMemo(() => {
        const categoryMap = {};
        tasks.forEach(task => {
            if (task.cost > 0) {
                if (!categoryMap[task.category]) {
                    categoryMap[task.category] = 0;
                }
                categoryMap[task.category] += Number(task.cost);
            }
        });
        return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    }, [tasks]);

    const weddingDate = settings.weddingDate ? new Date(settings.weddingDate) : null;
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!weddingDate) return;
        const interval = setInterval(() => {
            const now = new Date();
            const distance = weddingDate.getTime() - now.getTime();
            if (distance < 0) {
                clearInterval(interval);
                setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }
            setCountdown({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000),
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [weddingDate]);
    
    const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Bảng điều khiển</h1>
            
            {weddingDate ? (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-lg">
                    <h2 className="text-2xl font-bold text-center mb-4">Đếm ngược đến ngày cưới!</h2>
                    <div className="flex justify-center items-center space-x-4 md:space-x-8 text-center">
                        <div><p className="text-4xl font-bold">{countdown.days}</p><p className="text-sm opacity-80">Ngày</p></div>
                        <div><p className="text-4xl font-bold">{countdown.hours}</p><p className="text-sm opacity-80">Giờ</p></div>
                        <div><p className="text-4xl font-bold">{countdown.minutes}</p><p className="text-sm opacity-80">Phút</p></div>
                        <div><p className="text-4xl font-bold">{countdown.seconds}</p><p className="text-sm opacity-80">Giây</p></div>
                    </div>
                </div>
            ) : (
                <div className="p-6 rounded-2xl bg-white/50 backdrop-blur-lg border border-white/20 text-center">
                    <AlertTriangle className="mx-auto text-yellow-500 mb-2 h-8 w-8"/>
                    <h2 className="text-xl font-semibold text-gray-700">Vui lòng thiết lập ngày cưới!</h2>
                    <p className="text-gray-600 mb-4">Hãy vào mục Cài đặt để chọn ngày trọng đại của bạn.</p>
                    <button onClick={() => onNavigate('settings')} className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors">
                        Đi tới Cài đặt
                    </button>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Công việc" value={`${completedTasks}/${tasks.length}`} subtitle="đã hoàn thành" icon={<ListTodo />} onClick={() => onNavigate('tasks')} />
                <StatCard title="Ngân sách" value={formatCurrency(totalSpent)} subtitle="đã chi" icon={<Wallet />} onClick={() => onNavigate('budget')} />
                <StatCard title="Khách mời" value={`${guestsAttending}/${guests.length}`} subtitle="sẽ tham gia" icon={<Users />} onClick={() => onNavigate('guests')} />
                <StatCard title="Nhà cung cấp" value={vendors.length} subtitle="đối tác" icon={<Store />} onClick={() => onNavigate('vendors')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Phân tích Ngân sách</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={budgetData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {budgetData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Chi tiêu theo Hạng mục</h3>
                     <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={spendingByCategory} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                                <XAxis type="number" tickFormatter={formatCurrency} />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const StatCard = ({ title, value, subtitle, icon, onClick }) => (
    <motion.div
        whileHover={{ y: -5, scale: 1.02 }}
        onClick={onClick}
        className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20 cursor-pointer flex items-center space-x-4"
    >
        <div className="bg-pink-100 text-pink-500 p-3 rounded-full">
            {React.cloneElement(icon, { size: 24 })}
        </div>
        <div>
            <p className="text-sm text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
    </motion.div>
);


const Tasks = ({ tasks, setTasks, userId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState(null);
    
    const handleToggleComplete = async (task) => {
        const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, task.id);
        await updateDoc(taskRef, { completed: !task.completed });
    };

    const handleSaveTask = async (taskData) => {
        if (taskData.id) { // Cập nhật
            const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskData.id);
            await updateDoc(taskRef, taskData);
        } else { // Tạo mới
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/tasks`), taskData);
        }
        setIsModalOpen(false);
        setCurrentTask(null);
    };
    
    const handleDeleteTask = async (taskId) => {
        if(window.confirm("Bạn có chắc muốn xóa công việc này?")) {
            const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskId);
            await deleteDoc(taskRef);
        }
    };
    
    const openModalForNew = () => {
        setCurrentTask({ name: '', category: CATEGORIES.PHAT_SINH, priority: TASK_PRIORITIES.TRUNG_BINH, dueDate: '', cost: 0, completed: false });
        setIsModalOpen(true);
    };

    const openModalForEdit = (task) => {
        setCurrentTask(task);
        setIsModalOpen(true);
    };

    const tasksByDate = useMemo(() => {
        return [...tasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }, [tasks]);
    
    const AddTaskButton = () => (
         <button onClick={openModalForNew} className="flex items-center gap-2 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors shadow-md">
            <Plus size={18} /> Thêm công việc
        </button>
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Công việc cần làm</h1>
                {tasks.length > 0 && <AddTaskButton />}
            </div>
            
             {tasks.length === 0 ? (
                <EmptyState
                    icon={<ListTodo size={24} />}
                    title="Chưa có công việc nào"
                    message="Bắt đầu lên kế hoạch cho ngày trọng đại bằng cách thêm công việc đầu tiên."
                >
                    <AddTaskButton />
                </EmptyState>
            ) : (
                <div className="bg-white/50 backdrop-blur-lg p-4 sm:p-6 rounded-2xl shadow-md border border-white/20">
                    <div className="space-y-4">
                        {tasksByDate.map(task => (
                            <motion.div 
                                key={task.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className={`flex items-center p-4 rounded-xl transition-all duration-300 ${task.completed ? 'bg-green-100/70' : 'bg-white/80'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={task.completed}
                                    onChange={() => handleToggleComplete(task)}
                                    className="h-5 w-5 rounded border-gray-300 text-pink-500 focus:ring-pink-500 cursor-pointer"
                                />
                                <div className="ml-4 flex-grow">
                                    <p className={`font-semibold ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.name}</p>
                                    <div className="text-xs text-gray-500 flex items-center space-x-2 flex-wrap">
                                        <span>📅 {new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>
                                        <span>|</span>
                                        <span>{task.category}</span>
                                        <span>|</span>
                                        <span>💰 {Number(task.cost).toLocaleString('vi-VN')} VNĐ</span>
                                        <span>|</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            task.priority === TASK_PRIORITIES.CAO ? 'bg-red-100 text-red-800' : 
                                            task.priority === TASK_PRIORITIES.TRUNG_BINH ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>{task.priority}</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => openModalForEdit(task)} className="text-gray-500 hover:text-blue-600"><Edit size={18}/></button>
                                    <button onClick={() => handleDeleteTask(task.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={18}/></button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}


            <TaskModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                task={currentTask}
                onSave={handleSaveTask}
            />
        </motion.div>
    );
};

const TaskModal = ({ isOpen, onClose, task, onSave }) => {
    const [formData, setFormData] = useState(task);

    useEffect(() => {
        setFormData(task);
    }, [task]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!formData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={task.id ? 'Chỉnh sửa công việc' : 'Thêm công việc mới'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tên công việc</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" required/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Hạng mục</label>
                        <select name="category" value={formData.category} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800">
                            {Object.values(CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Mức ưu tiên</label>
                        <select name="priority" value={formData.priority} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800">
                           {Object.values(TASK_PRIORITIES).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Hạn chót</label>
                        <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" style={{ colorScheme: 'light' }} required/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Chi phí (VNĐ)</label>
                        <input type="number" name="cost" value={formData.cost} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Hủy</button>
                    <button type="submit" className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600">{task.id ? 'Lưu thay đổi' : 'Tạo mới'}</button>
                </div>
            </form>
        </Modal>
    );
};

const Budget = ({ tasks, settings, onUpdateSettings, userId }) => {
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [newBudget, setNewBudget] = useState(settings.totalBudget || 200000000);
    
    const totalSpent = useMemo(() => tasks.reduce((sum, task) => sum + (Number(task.cost) || 0), 0), [tasks]);
    const totalBudget = settings.totalBudget || 200000000;
    const remaining = totalBudget - totalSpent;
    const percentageSpent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    
    const spendingByCategory = useMemo(() => {
        const categoryMap = {};
        tasks.forEach(task => {
            if (task.cost > 0) {
                if (!categoryMap[task.category]) {
                    categoryMap[task.category] = 0;
                }
                categoryMap[task.category] += Number(task.cost);
            }
        });
        return Object.entries(categoryMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    }, [tasks]);
    
    const handleSaveBudget = () => {
        onUpdateSettings({ totalBudget: Number(newBudget) });
        setIsEditingBudget(false);
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Quản lý Ngân sách</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20 text-center">
                        <h3 className="text-lg font-semibold text-gray-600">Tổng ngân sách</h3>
                         {isEditingBudget ? (
                            <div className="flex items-center gap-2 mt-2">
                                <input 
                                    type="number" 
                                    value={newBudget}
                                    onChange={(e) => setNewBudget(e.target.value)}
                                    className="w-full text-2xl font-bold text-gray-800 bg-transparent border-b-2 border-pink-400 focus:outline-none text-center"
                                />
                                <button onClick={handleSaveBudget} className="text-green-500 hover:text-green-700"><Check size={20}/></button>
                                <button onClick={() => setIsEditingBudget(false)} className="text-red-500 hover:text-red-700"><X size={20}/></button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <p className="text-3xl font-bold text-pink-500">{formatCurrency(totalBudget)}</p>
                                <button onClick={() => setIsEditingBudget(true)} className="text-gray-500 hover:text-blue-600"><Edit size={18}/></button>
                            </div>
                        )}
                    </div>
                    <div className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20">
                        <h3 className="text-lg font-semibold text-gray-600">Đã chi</h3>
                        <p className="text-2xl font-bold text-orange-500 mt-2">{formatCurrency(totalSpent)}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
                            <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${percentageSpent}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20">
                        <h3 className="text-lg font-semibold text-gray-600">Còn lại</h3>
                        <p className={`text-2xl font-bold mt-2 ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(remaining)}
                        </p>
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Chi tiết chi tiêu theo hạng mục</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {spendingByCategory.map(({ name, value }) => (
                            <div key={name}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700">{name}</span>
                                    <span className="text-gray-600">{formatCurrency(value)}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(value / totalSpent) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};


const Guests = ({ guests, setGuests, userId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentGuest, setCurrentGuest] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const handleSaveGuest = async (guestData) => {
        if (guestData.id) {
            const guestRef = doc(db, `artifacts/${appId}/users/${userId}/guests`, guestData.id);
            await updateDoc(guestRef, guestData);
        } else {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/guests`), { ...guestData, table: guestData.table || 'Chưa xếp' });
        }
        setIsModalOpen(false);
        setCurrentGuest(null);
    };

    const handleDeleteGuest = async (guestId) => {
        if(window.confirm("Bạn có chắc muốn xóa khách mời này?")) {
            const guestRef = doc(db, `artifacts/${appId}/users/${userId}/guests`, guestId);
            await deleteDoc(guestRef);
        }
    };

    const openModalForNew = () => {
        setCurrentGuest({ name: '', side: 'Nhà trai', rsvpStatus: GUEST_RSVP.CHUA_TRA_LOI, table: '', dietaryNotes: '' });
        setIsModalOpen(true);
    };

    const openModalForEdit = (guest) => {
        setCurrentGuest(guest);
        setIsModalOpen(true);
    };

    const filteredGuests = useMemo(() => 
        guests.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [guests, searchTerm]
    );

    const stats = useMemo(() => ({
        total: guests.length,
        attending: guests.filter(g => g.rsvpStatus === GUEST_RSVP.THAM_GIA).length,
        declined: guests.filter(g => g.rsvpStatus === GUEST_RSVP.TU_CHOI).length,
        pending: guests.filter(g => g.rsvpStatus === GUEST_RSVP.CHUA_TRA_LOI).length,
    }), [guests]);

    const AddGuestButton = () => (
         <button onClick={openModalForNew} className="flex items-center justify-center gap-2 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors shadow-md">
            <Plus size={18} /> Thêm khách mời
        </button>
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Danh sách khách mời</h1>
                 {guests.length > 0 && <AddGuestButton />}
            </div>
            
             {guests.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white/40 backdrop-blur-md p-4 rounded-lg border border-white/20"><p className="font-bold text-xl text-gray-700">{stats.total}</p><p className="text-sm text-gray-600">Tổng cộng</p></div>
                    <div className="bg-green-100/60 backdrop-blur-md p-4 rounded-lg border border-white/20"><p className="font-bold text-xl text-green-700">{stats.attending}</p><p className="text-sm text-green-600">Tham gia</p></div>
                    <div className="bg-red-100/60 backdrop-blur-md p-4 rounded-lg border border-white/20"><p className="font-bold text-xl text-red-700">{stats.declined}</p><p className="text-sm text-red-600">Từ chối</p></div>
                    <div className="bg-yellow-100/60 backdrop-blur-md p-4 rounded-lg border border-white/20"><p className="font-bold text-xl text-yellow-700">{stats.pending}</p><p className="text-sm text-yellow-600">Chờ trả lời</p></div>
                </div>
            )}

            {guests.length === 0 ? (
                <EmptyState
                    icon={<Users size={24} />}
                    title="Chưa có khách mời nào"
                    message="Hãy bắt đầu xây dựng danh sách những người thân yêu sẽ chung vui cùng bạn."
                >
                    <AddGuestButton />
                </EmptyState>
            ) : (
                <div className="bg-white/50 backdrop-blur-lg p-4 sm:p-6 rounded-2xl shadow-md border border-white/20">
                    <input 
                        type="text"
                        placeholder="Tìm kiếm khách mời..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full mb-4 px-4 py-2 rounded-lg border border-gray-300 focus:ring-pink-500 focus:border-pink-500 text-gray-800"
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Tên</th>
                                    <th scope="col" className="px-6 py-3">Phía</th>
                                    <th scope="col" className="px-6 py-3">Trạng thái (RSVP)</th>
                                    <th scope="col" className="px-6 py-3">Bàn</th>
                                    <th scope="col" className="px-6 py-3">Ghi chú</th>
                                    <th scope="col" className="px-6 py-3">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGuests.map(guest => (
                                    <tr key={guest.id} className="bg-white/70 border-b border-gray-200/50 hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{guest.name}</td>
                                        <td className="px-6 py-4">{guest.side}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                guest.rsvpStatus === GUEST_RSVP.THAM_GIA ? 'bg-green-100 text-green-800' :
                                                guest.rsvpStatus === GUEST_RSVP.TU_CHOI ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>{guest.rsvpStatus}</span>
                                        </td>
                                        <td className="px-6 py-4">{guest.table || 'N/A'}</td>
                                        <td className="px-6 py-4 truncate max-w-xs">{guest.dietaryNotes || 'Không có'}</td>
                                        <td className="px-6 py-4 flex items-center gap-3">
                                            <button onClick={() => openModalForEdit(guest)} className="text-gray-500 hover:text-blue-600"><Edit size={18}/></button>
                                            <button onClick={() => handleDeleteGuest(guest.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <GuestModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                guest={currentGuest}
                onSave={handleSaveGuest}
            />
        </motion.div>
    );
};

const GuestModal = ({ isOpen, onClose, guest, onSave }) => {
    const [formData, setFormData] = useState(guest);

    useEffect(() => {
        setFormData(guest);
    }, [guest]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!formData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={guest.id ? 'Chỉnh sửa khách mời' : 'Thêm khách mời mới'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tên khách mời</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" required/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Phía</label>
                        <select name="side" value={formData.side} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800">
                            <option>Nhà trai</option>
                            <option>Nhà gái</option>
                            <option>Bạn chung</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Trạng thái RSVP</label>
                        <select name="rsvpStatus" value={formData.rsvpStatus} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800">
                            {Object.values(GUEST_RSVP).map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Số bàn</label>
                        <input type="text" name="table" value={formData.table} onChange={handleChange} placeholder="VD: Bàn 5, Bàn VIP 1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800"/>
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Ghi chú (ăn kiêng, dị ứng...)</label>
                    <textarea name="dietaryNotes" value={formData.dietaryNotes} onChange={handleChange} rows="3" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800"></textarea>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Hủy</button>
                    <button type="submit" className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600">{guest.id ? 'Lưu thay đổi' : 'Tạo mới'}</button>
                </div>
            </form>
        </Modal>
    );
};


const Invitations = ({ guests, settings }) => {
    const [selectedGuest, setSelectedGuest] = useState(null);
    const weddingDate = settings.weddingDate ? new Date(settings.weddingDate) : null;
    
    // VietQR URL - thay thế bằng link VietQR thật của bạn
    // Cấu trúc: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<INFO>&accountName=<NAME>
    const vietQRUrl = `https://img.vietqr.io/image/970436-0987654321-print.png?accountName=NGUYEN%20VAN%20A`;

    const CountdownTimer = ({ targetDate }) => {
        const [timeLeft, setTimeLeft] = useState(null);
        useEffect(() => {
            if (!targetDate) return;
            const timer = setInterval(() => {
                const difference = +new Date(targetDate) - +new Date();
                if (difference > 0) {
                    setTimeLeft({
                        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                        minutes: Math.floor((difference / 1000 / 60) % 60),
                        seconds: Math.floor((difference / 1000) % 60),
                    });
                } else {
                    clearInterval(timer);
                    setTimeLeft(null);
                }
            }, 1000);
            return () => clearInterval(timer);
        }, [targetDate]);

        if (!timeLeft) return <div className="text-center text-4xl font-bold text-pink-600 my-4"><PartyPopper className="inline-block" size={40}/> Hôn lễ đang diễn ra!</div>;
        
        return (
            <div className="flex justify-center space-x-4 my-6">
                {Object.entries(timeLeft).map(([unit, value]) => (
                    <div key={unit} className="text-center">
                        <div className="text-4xl font-bold text-gray-800">{value}</div>
                        <div className="text-sm uppercase text-gray-500">{unit}</div>
                    </div>
                ))}
            </div>
        );
    };

    const InvitationCard = ({ guest, weddingDate, qrUrl }) => (
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl mx-auto font-serif" style={{ fontFamily: "'Dancing Script', cursive" }}>
             <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');`}
             </style>
            <div className="text-center">
                <p className="text-2xl text-gray-500">Trân trọng kính mời</p>
                <h2 className="text-4xl font-bold text-pink-600 my-4">{guest.name}</h2>
                <p className="text-2xl text-gray-500">đến chung vui cùng gia đình chúng tôi tại</p>
                <h1 className="text-5xl text-gray-800 font-bold my-6">Lễ Thành Hôn</h1>
                <p className="text-3xl text-gray-700">{settings.groomName || 'Chú Rể'} & {settings.brideName || 'Cô Dâu'}</p>
                {weddingDate && (
                    <>
                        <p className="text-xl text-gray-600 mt-6">Vào lúc {new Date(weddingDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-xl text-gray-600">Ngày {new Date(weddingDate).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </>
                )}
                <p className="text-xl text-gray-600 mt-2">Tại {settings.venueName || 'Trung tâm tiệc cưới ABC'}</p>
                <CountdownTimer targetDate={weddingDate} />
                <p className="text-lg text-gray-500 mt-8">Sự hiện diện của bạn là niềm vinh hạnh cho gia đình chúng tôi!</p>
                <div className="mt-8 border-t pt-6">
                    <h3 className="text-2xl text-gray-700 mb-4">Mừng cưới</h3>
                    <img src={qrUrl} alt="VietQR Mừng cưới" className="mx-auto w-48 h-48 rounded-md" 
                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/192x192/e2e8f0/334155?text=VietQR'; }} />
                    <p className="text-sm text-gray-500 mt-2">Quét mã để gửi lời chúc mừng</p>
                </div>
            </div>
        </div>
    );
    
    if (!settings.weddingDate) {
        return (
             <div className="text-center p-8 bg-white/50 backdrop-blur-lg rounded-xl">
                 <AlertTriangle className="mx-auto text-yellow-500 mb-2 h-10 w-10"/>
                 <h2 className="text-xl font-semibold text-gray-700">Chưa có thông tin lễ cưới</h2>
                 <p className="text-gray-600">Vui lòng vào Cài đặt để thêm ngày và các thông tin cần thiết cho thiệp mời.</p>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Thiệp mời điện tử</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-white/50 backdrop-blur-lg p-4 rounded-2xl shadow-md border border-white/20 h-fit">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Chọn khách mời để xem thiệp</h3>
                    <ul className="space-y-2 max-h-96 overflow-y-auto">
                        {guests.map(guest => (
                            <li key={guest.id}>
                                <button
                                    onClick={() => setSelectedGuest(guest)}
                                    className={`w-full text-left p-2 rounded-lg transition-colors ${selectedGuest?.id === guest.id ? 'bg-pink-200 text-pink-800' : 'hover:bg-gray-200/50'}`}
                                >
                                    {guest.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="md:col-span-2">
                    {selectedGuest ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedGuest.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <InvitationCard guest={selectedGuest} weddingDate={weddingDate} qrUrl={vietQRUrl} />
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-white/50 backdrop-blur-lg p-8 rounded-2xl shadow-md border border-white/20">
                            <p className="text-gray-600 text-lg">Vui lòng chọn một khách mời từ danh sách để xem trước thiệp mời.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};


const Vendors = ({ vendors, setVendors, userId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentVendor, setCurrentVendor] = useState(null);

    const handleSaveVendor = async (vendorData) => {
        if (vendorData.id) {
            const vendorRef = doc(db, `artifacts/${appId}/users/${userId}/vendors`, vendorData.id);
            await updateDoc(vendorRef, vendorData);
        } else {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/vendors`), vendorData);
        }
        setIsModalOpen(false);
        setCurrentVendor(null);
    };

    const handleDeleteVendor = async (vendorId) => {
        if(window.confirm("Bạn có chắc muốn xóa nhà cung cấp này?")) {
            const vendorRef = doc(db, `artifacts/${appId}/users/${userId}/vendors`, vendorId);
            await deleteDoc(vendorRef);
        }
    };
    
    const openModalForNew = () => {
        setCurrentVendor({ name: '', category: CATEGORIES.DIA_DIEM, status: VENDOR_STATUSES.TIEM_NANG, contact: '', cost: 0 });
        setIsModalOpen(true);
    };

    const openModalForEdit = (vendor) => {
        setCurrentVendor(vendor);
        setIsModalOpen(true);
    };
    
    const AddVendorButton = () => (
         <button onClick={openModalForNew} className="flex items-center gap-2 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors shadow-md">
            <Plus size={18} /> Thêm nhà cung cấp
        </button>
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Nhà cung cấp</h1>
                {vendors.length > 0 && <AddVendorButton />}
            </div>

            {vendors.length === 0 ? (
                 <EmptyState
                    icon={<Store size={24} />}
                    title="Chưa có nhà cung cấp"
                    message="Lưu trữ thông tin các đối tác dịch vụ cưới của bạn ở đây."
                >
                    <AddVendorButton />
                </EmptyState>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendors.map(vendor => (
                        <motion.div 
                            key={vendor.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white/60 backdrop-blur-lg p-5 rounded-2xl shadow-md border border-white/20 flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-lg text-gray-800">{vendor.name}</h3>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        vendor.status === VENDOR_STATUSES.XAC_NHAN ? 'bg-green-100 text-green-800' :
                                        vendor.status === VENDOR_STATUSES.DA_DAT ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>{vendor.status}</span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{vendor.category}</p>
                                <p className="text-sm text-gray-600 mt-3">Liên hệ: {vendor.contact}</p>
                                <p className="text-md font-semibold text-gray-700 mt-1">Chi phí: {Number(vendor.cost).toLocaleString('vi-VN')} VNĐ</p>
                            </div>
                            <div className="flex justify-end items-center gap-3 mt-4 pt-3 border-t border-gray-200/60">
                                <button onClick={() => openModalForEdit(vendor)} className="text-gray-500 hover:text-blue-600"><Edit size={18}/></button>
                                <button onClick={() => handleDeleteVendor(vendor.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={18}/></button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
            
            <VendorModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                vendor={currentVendor}
                onSave={handleSaveVendor}
            />
        </motion.div>
    );
};

const VendorModal = ({ isOpen, onClose, vendor, onSave }) => {
    const [formData, setFormData] = useState(vendor);

    useEffect(() => {
        setFormData(vendor);
    }, [vendor]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!formData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={vendor.id ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Tên nhà cung cấp</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" required/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Hạng mục</label>
                        <select name="category" value={formData.category} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800">
                            {Object.values(CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800">
                            {Object.values(VENDOR_STATUSES).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Chi phí (VNĐ)</label>
                        <input type="number" name="cost" value={formData.cost} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Thông tin liên hệ</label>
                    <input type="text" name="contact" value={formData.contact} onChange={handleChange} placeholder="SĐT, Email,..." className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Hủy</button>
                    <button type="submit" className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600">{vendor.id ? 'Lưu thay đổi' : 'Tạo mới'}</button>
                </div>
            </form>
        </Modal>
    );
};

const Settings = ({ settings, onUpdateSettings, userId, onResetTasks }) => {
    const [localSettings, setLocalSettings] = useState(settings || { totalBudget: 200000000, weddingDate: null, groomName: '', brideName: '', venueName: '' });

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onUpdateSettings(localSettings);
        alert('Cài đặt đã được lưu!');
    };

    const handleReset = () => {
        if(window.confirm("Hành động này sẽ XÓA TẤT CẢ công việc hiện tại và tạo lại timeline 180 ngày dựa trên ngày cưới mới. Bạn có chắc chắn?")) {
            onResetTasks(localSettings.weddingDate);
        }
    }
    
    if (!localSettings) {
        return <Spinner />;
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800">Cài đặt</h1>
            <div className="bg-white/50 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-white/20 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Ngày cưới</label>
                    <input 
                        type="date" 
                        name="weddingDate" 
                        value={localSettings.weddingDate || ''} 
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800"
                        style={{ colorScheme: 'light' }}
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tên chú rể</label>
                        <input type="text" name="groomName" value={localSettings.groomName || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Tên cô dâu</label>
                        <input type="text" name="brideName" value={localSettings.brideName || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Địa điểm tổ chức</label>
                    <input type="text" name="venueName" value={localSettings.venueName || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Tổng ngân sách (VNĐ)</label>
                    <input type="number" name="totalBudget" value={localSettings.totalBudget || 200000000} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-gray-800" />
                </div>
                <div className="flex justify-between items-center pt-4 border-t mt-4 border-gray-200/50">
                    <button onClick={handleSave} className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition-colors">Lưu cài đặt</button>
                    {localSettings.weddingDate && (
                         <button onClick={handleReset} className="flex items-center gap-2 text-sm bg-yellow-400 text-yellow-900 px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors">
                            <AlertTriangle size={16}/> Đặt lại Timeline Công việc
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};


// --- COMPONENT CHÍNH: App ---
export default function App() {
    // --- CHẾ ĐỘ DEMO ---
    const demoUser = {
        uid: 'demo-user-123',
        displayName: 'Khách Demo',
        email: 'demo@example.com',
        photoURL: 'https://placehold.co/100x100/E9D5FF/334155?text=D',
    };
    const [user, setUser] = useState(demoUser);
    const [loading, setLoading] = useState(false);
    // --- KẾT THÚC CHẾ ĐỘ DEMO ---

    const [page, setPage] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Dữ liệu
    const [tasks, setTasks] = useState([]);
    const [guests, setGuests] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [settings, setSettings] = useState(null); 

    // Hook để lắng nghe dữ liệu từ Firestore
    const useCollection = (collectionName) => {
        const [data, setData] = useState([]);
        useEffect(() => {
            if (!user) {
                setData([]);
                return;
            };
            const collectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/${collectionName}`);
            const q = query(collectionRef);
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                setData(items);
            });
            return () => unsubscribe();
        }, [user, collectionName]);
        return data;
    };
    
    // Sử dụng hook cho từng collection
    const tasksData = useCollection('tasks');
    const guestsData = useCollection('guests');
    const vendorsData = useCollection('vendors');

    useEffect(() => setTasks(tasksData), [tasksData]);
    useEffect(() => setGuests(guestsData), [guestsData]);
    useEffect(() => setVendors(vendorsData), [vendorsData]);

    // Lắng nghe settings
    useEffect(() => {
        if (!user) return;
        const settingsRef = doc(db, `artifacts/${appId}/users/${user.uid}/settings`, 'main');
        const unsubscribe = onSnapshot(settingsRef, (doc) => {
            if (doc.exists()) {
                setSettings(doc.data());
            } else {
                 const defaultSettings = { totalBudget: 200000000, weddingDate: null, groomName: '', brideName: '', venueName: '' };
                 setDoc(settingsRef, defaultSettings);
                 setSettings(defaultSettings);
            }
        });
        return () => unsubscribe();
    }, [user]);

    const handleLogout = () => {
        alert('Chức năng đăng xuất không có sẵn trong chế độ Demo.');
    };

    const handleUpdateSettings = async (newSettings) => {
        if (!user) return;
        const settingsRef = doc(db, `artifacts/${appId}/users/${user.uid}/settings`, 'main');
        await setDoc(settingsRef, newSettings, { merge: true });
    };

    const handleResetTasks = async (weddingDate) => {
        if (!user || !weddingDate) {
            alert("Vui lòng chọn ngày cưới trước khi đặt lại timeline.");
            return;
        }
        
        const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/tasks`);
        const oldTasksSnapshot = await getDocs(tasksCollectionRef);
        const batch = writeBatch(db);
        oldTasksSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        const newTasks = getDefaultTasks(weddingDate);
        newTasks.forEach(task => {
            const newTaskRef = doc(tasksCollectionRef);
            batch.set(newTaskRef, task);
        });
        
        await batch.commit();

        alert("Timeline công việc đã được làm mới!");
        setPage('tasks');
    };

    const navigate = (pageName) => {
        setPage(pageName);
        setIsSidebarOpen(false);
    }
    
    const navItems = [
        { id: 'dashboard', label: 'Bảng điều khiển', icon: <LayoutDashboard /> },
        { id: 'tasks', label: 'Công việc', icon: <ListTodo /> },
        { id: 'budget', label: 'Ngân sách', icon: <Wallet /> },
        { id: 'guests', label: 'Khách mời', icon: <Users /> },
        { id: 'invitations', label: 'Thiệp mời', icon: <Mail /> },
        { id: 'vendors', label: 'Nhà cung cấp', icon: <Store /> },
        { id: 'settings', label: 'Cài đặt', icon: <Settings /> },
    ];

    const renderPage = () => {
        if (loading || !settings) {
            return <Spinner />;
        }
        if (!user) {
             return <div>Đang tải...</div>;
        }
        switch (page) {
            case 'dashboard':
                return <Dashboard tasks={tasks} budget={settings.totalBudget} guests={guests} vendors={vendors} settings={settings} onNavigate={navigate} userId={user.uid} />;
            case 'tasks':
                return <Tasks tasks={tasks} setTasks={setTasks} userId={user.uid} />;
            case 'budget':
                return <Budget tasks={tasks} settings={settings} onUpdateSettings={handleUpdateSettings} userId={user.uid} />;
            case 'guests':
                return <Guests guests={guests} setGuests={setGuests} userId={user.uid} />;
            case 'invitations':
                return <Invitations guests={guests} settings={settings}/>;
            case 'vendors':
                return <Vendors vendors={vendors} setVendors={setVendors} userId={user.uid} />;
            case 'settings':
                return <Settings settings={settings} onUpdateSettings={handleUpdateSettings} userId={user.uid} onResetTasks={handleResetTasks}/>;
            default:
                return <Dashboard tasks={tasks} budget={settings.totalBudget} guests={guests} vendors={vendors} settings={settings} onNavigate={navigate} userId={user.uid} />;
        }
    };
    
    return (
        <div className="bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-200 min-h-screen font-sans text-gray-800">
            <div className="flex h-screen">
                {/* Sidebar cho desktop */}
                <aside className="hidden lg:flex lg:flex-shrink-0 w-64 bg-white/40 backdrop-blur-lg border-r border-white/30">
                     <div className="flex flex-col h-full w-full p-4">
                        <div className="flex items-center gap-3 mb-10 px-2">
                            <PartyPopper className="text-pink-500" size={32}/>
                            <h2 className="text-xl font-bold text-gray-800">Wedding Planner</h2>
                        </div>
                        <nav className="flex-grow space-y-2">
                           {navItems.map(item => (
                               <button key={item.id} onClick={() => navigate(item.id)} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-left ${page === item.id ? 'bg-pink-500 text-white shadow-md' : 'hover:bg-pink-100'}`}>
                                   {item.icon}
                                   <span>{item.label}</span>
                               </button>
                           ))}
                        </nav>
                        <div className="flex-shrink-0">
                            <div className="flex items-center gap-3 mb-4 p-2">
                                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full"/>
                                <div>
                                    <p className="font-semibold text-sm">{user.displayName}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors">
                                <LogOut size={16}/> Đăng xuất (Demo)
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                     {/* Header cho mobile/tablet */}
                    <header className="lg:hidden flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <PartyPopper className="text-pink-500" size={24}/>
                            <h2 className="text-lg font-bold">W-Planner</h2>
                        </div>
                         <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </header>
                     <AnimatePresence mode="wait">{renderPage()}</AnimatePresence>
                </main>

                 {/* Sidebar cho mobile (modal) */}
                <AnimatePresence>
                    {isSidebarOpen && (
                         <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'tween', ease: 'easeInOut' }}
                            className="fixed top-0 right-0 h-full w-64 bg-white/80 backdrop-blur-xl shadow-2xl z-40 p-6 lg:hidden"
                        >
                           <div className="flex justify-between items-center mb-10">
                               <h2 className="text-xl font-bold">Menu</h2>
                               <button onClick={() => setIsSidebarOpen(false)}><X size={24}/></button>
                           </div>
                           <nav className="space-y-2">
                               {navItems.map(item => (
                                   <button key={item.id} onClick={() => navigate(item.id)} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-left ${page === item.id ? 'bg-pink-500 text-white' : 'hover:bg-pink-100'}`}>
                                       {item.icon}
                                       <span>{item.label}</span>
                                   </button>
                               ))}
                           </nav>
                            <div className="absolute bottom-6 left-6 right-6">
                                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors">
                                    <LogOut size={16}/> Đăng xuất (Demo)
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
