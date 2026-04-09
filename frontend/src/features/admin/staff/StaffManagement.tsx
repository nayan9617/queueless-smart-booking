import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { Trash2, UserPlus, ToggleLeft, ToggleRight, Loader2, User, X, Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Staff {
    _id: string;
    name: string;
    role: 'barber' | 'manager';
    isAvailable: boolean;
}

const StaffManagement = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffRole, setNewStaffRole] = useState<'barber' | 'manager'>('barber');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: staff, isLoading } = useQuery<Staff[]>({
        queryKey: ['staff'],
        queryFn: async () => {
            const res = await api.get('/staff');
            return res.data;
        },
    });

    const addStaffMutation = useMutation({
        mutationFn: async (data: { name: string; role: string }) => {
            await api.post('/staff', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setIsModalOpen(false);
            setNewStaffName('');
            toast.success('Staff added successfully');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to add staff');
        }
    });

    const removeStaffMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/staff/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            toast.success('Staff removed');
        }
    });

    const toggleAvailabilityMutation = useMutation({
        mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
            await api.patch(`/staff/${id}/availability`, { isAvailable });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            toast.success('Availability updated');
        }
    });

    const filteredStaff = staff?.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const availableCount = staff?.filter(s => s.isAvailable).length || 0;

    if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Staff Management</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {availableCount} of {staff?.length || 0} staff available
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    <UserPlus size={18} /> <span className="hidden sm:inline">Add Staff</span>
                </button>
            </div>

            {/* Search */}
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search staff..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm text-slate-900 dark:text-white"
                    />
                </div>
            </div>

            {/* Staff List */}
            <div className="flex-1 overflow-y-auto p-6">
                {filteredStaff?.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <User size={48} className="mx-auto mb-3 opacity-20" />
                        <p>No staff found matching your search.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredStaff?.map((member) => (
                            <div key={member._id} className="group p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-md transition-all bg-white dark:bg-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                                        ${member.isAvailable ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                        {member.name.charAt(0).toUpperCase()}
                                        {/* Status Dot */}
                                        <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white dark:border-slate-800 rounded-full 
                                            ${member.isAvailable ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white">{member.name}</h3>
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                            {member.role}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleAvailabilityMutation.mutate({ id: member._id, isAvailable: !member.isAvailable })}
                                        title={member.isAvailable ? "Mark Unavailable" : "Mark Available"}
                                        className={`p-2 rounded-lg transition-colors
                                            ${member.isAvailable
                                                ? 'text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400'
                                                : 'text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300'}`}
                                    >
                                        {member.isAvailable ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                    </button>

                                    <div className="w-px h-8 bg-slate-100 dark:bg-slate-700 mx-1"></div>

                                    <button
                                        onClick={() => removeStaffMutation.mutate(member._id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove Staff"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Staff Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 scale-100">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New Staff Member</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={newStaffName}
                                    onChange={(e) => setNewStaffName(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    placeholder="e.g. John Doe"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setNewStaffRole('barber')}
                                        className={`flex items-center justify-center gap-2 py-2 rounded-xl border transition-all
                                            ${newStaffRole === 'barber'
                                                ? 'border-primary bg-primary/5 dark:bg-primary/20 text-primary font-bold'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    >
                                        Barber
                                    </button>
                                    <button
                                        onClick={() => setNewStaffRole('manager')}
                                        className={`flex items-center justify-center gap-2 py-2 rounded-xl border transition-all
                                            ${newStaffRole === 'manager'
                                                ? 'border-primary bg-primary/5 dark:bg-primary/20 text-primary font-bold'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    >
                                        Manager
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => addStaffMutation.mutate({ name: newStaffName, role: newStaffRole })}
                                disabled={!newStaffName || addStaffMutation.isPending}
                                className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                            >
                                {addStaffMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                Add Member
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManagement;
