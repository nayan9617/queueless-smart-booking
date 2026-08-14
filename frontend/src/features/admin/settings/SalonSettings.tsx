import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { Loader2, Store, MapPin, Armchair, Plus, Trash2, Save, Upload } from 'lucide-react';
import { mediaUrl } from '../../../utils/mediaUrl';

interface Service {
    name: string;
    durationMin: number;
    price: number;
}

interface SalonData {
    _id: string;
    name: string;
    address: string;
    chairs: number;
    images: string[];
    services: Service[];
    status: string;
}

const SalonSettings = () => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<SalonData | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [newService, setNewService] = useState({ name: '', durationMin: 30, price: 0 });
    const [newImage, setNewImage] = useState('');
    const [isAddingService, setIsAddingService] = useState(false);
    const [isAddingImage, setIsAddingImage] = useState(false);

    const { data, isLoading } = useQuery<{ salon: SalonData }>({
        queryKey: ['my-salon-settings'],
        queryFn: async () => {
            const res = await api.get('/bookings/salon-bookings');
            return res.data;
        }
    });

    useEffect(() => {
        if (data?.salon && !isDirty) {
            setFormData(data.salon);
        }
    }, [data, isDirty]);

    const updateSalonMutation = useMutation({
        mutationFn: async (updatedData: Partial<SalonData>) => {
            if (!formData?._id) return;
            // Clean up data before sending if needed
            const { _id, ...rest } = updatedData as any;
            await api.patch(`/salons/${formData._id}`, rest);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-salon-settings'] });
            queryClient.invalidateQueries({ queryKey: ['my-salon'] }); // Invalidate admin dashboard data
            toast.success('Salon settings updated');
            setIsDirty(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to update settings');
        }
    });

    const handleSave = () => {
        if (!formData) return;
        updateSalonMutation.mutate(formData);
    };

    const handleChange = (field: keyof SalonData, value: any) => {
        if (!formData) return;
        setFormData({ ...formData, [field]: value });
        setIsDirty(true);
    };

    const handleDeviceUpload = async (files: FileList | null) => {
        if (!files?.length || !formData?._id) return;
        setUploading(true);
        try {
            const body = new FormData();
            Array.from(files).forEach((f) => body.append('images', f));
            const res = await api.post(`/salons/${formData._id}/images`, body);
            setFormData({ ...formData, images: res.data.images });
            setIsDirty(false);
            queryClient.invalidateQueries({ queryKey: ['my-salon-settings'] });
            queryClient.invalidateQueries({ queryKey: ['my-salon'] });
            toast.success('Photos uploaded');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isLoading || !formData) {
        return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" size={32} /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Actions */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Salon Details</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Update your salon establishment information.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!isDirty || updateSalonMutation.isPending}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                >
                    {updateSalonMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Changes
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Basic Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
                        <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">General Information</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Salon Name</label>
                            <div className="relative">
                                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => handleChange('address', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white transition-all min-h-[80px] resize-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Capacity (Chairs)</label>
                            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                <Armchair className="text-primary" size={24} />
                                <div className="flex-1">
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        value={formData.chairs}
                                        onChange={(e) => handleChange('chairs', parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className="flex justify-between mt-1 text-xs font-medium text-slate-500">
                                        <span>1</span>
                                        <span className="text-primary font-bold text-sm">{formData.chairs} Chairs</span>
                                        <span>20</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                            <h3 className="font-bold text-slate-900 dark:text-white">Services Menu</h3>
                        </div>

                        <div className="space-y-3">
                            {formData.services.map((service, index) => (
                                <div key={index} className="flex gap-3 items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700 group">
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <input
                                            type="text"
                                            value={service.name}
                                            onChange={(e) => {
                                                const newServices = [...formData.services];
                                                newServices[index].name = e.target.value;
                                                handleChange('services', newServices);
                                            }}
                                            className="bg-transparent text-slate-900 dark:text-white font-medium focus:outline-none border-b border-transparent focus:border-primary"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={service.price}
                                                onChange={(e) => {
                                                    const newServices = [...formData.services];
                                                    newServices[index].price = Number(e.target.value);
                                                    handleChange('services', newServices);
                                                }}
                                                className="w-20 bg-transparent text-slate-600 dark:text-slate-300 text-sm focus:outline-none border-b border-transparent focus:border-primary text-right"
                                            />
                                            <span className="text-slate-400 text-sm">₹</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400">{service.durationMin}m</div>
                                    <button
                                        onClick={() => {
                                            const newServices = [...formData.services];
                                            newServices.splice(index, 1);
                                            handleChange('services', newServices);
                                        }}
                                        className="text-red-400 hover:text-red-500 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove Service"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            {/* Add Service Section */}
                            {isAddingService ? (
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                    <input
                                        type="text"
                                        placeholder="Service Name"
                                        value={newService.name}
                                        onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                placeholder="Price"
                                                value={newService.price || ''}
                                                onChange={(e) => setNewService({ ...newService, price: Number(e.target.value) })}
                                                className="w-full pl-6 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                            <span className="absolute left-3 top-2 text-slate-400 text-sm">₹</span>
                                        </div>
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                placeholder="Mins"
                                                value={newService.durationMin || ''}
                                                onChange={(e) => setNewService({ ...newService, durationMin: Number(e.target.value) })}
                                                className="w-full pr-8 pl-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                            <span className="absolute right-3 top-2 text-slate-400 text-sm">min</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsAddingService(false)}
                                            className="flex-1 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (newService.name && newService.price && newService.durationMin) {
                                                    const updatedServices = [...formData.services, newService];
                                                    handleChange('services', updatedServices);
                                                    setNewService({ name: '', durationMin: 30, price: 0 });
                                                    setIsAddingService(false);
                                                }
                                            }}
                                            disabled={!newService.name || !newService.price}
                                            className="flex-1 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingService(true)}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} /> Add Service
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Photos */}
                <div className="md:col-span-1">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 sticky top-6">
                        <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Salon Photo Album</h3>
                        <p className="text-xs text-slate-500">Upload from your device or paste image links. Customers see these as a gallery.</p>

                        <div className="space-y-3">
                            {formData.images.map((img, index) => (
                                <div key={`${img}-${index}`} className="relative group">
                                    <img
                                        src={mediaUrl(img)}
                                        alt={`Salon ${index + 1}`}
                                        className="w-full h-32 object-cover rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/300?text=Error+Loading+Image')}
                                    />
                                    <button
                                        onClick={() => {
                                            const newImages = [...formData.images];
                                            newImages.splice(index, 1);
                                            handleChange('images', newImages);
                                        }}
                                        className="absolute top-2 right-2 bg-white/90 dark:bg-slate-900/90 text-red-500 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                multiple
                                className="hidden"
                                onChange={(e) => handleDeviceUpload(e.target.files)}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                {uploading ? 'Uploading…' : 'Upload from device'}
                            </button>

                            {isAddingImage ? (
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                    <input
                                        type="text"
                                        placeholder="Image URL (https://...)"
                                        value={newImage}
                                        onChange={(e) => setNewImage(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsAddingImage(false)}
                                            className="flex-1 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (newImage) {
                                                    const updatedImages = [...formData.images, newImage];
                                                    handleChange('images', updatedImages);
                                                    setNewImage('');
                                                    setIsAddingImage(false);
                                                }
                                            }}
                                            disabled={!newImage}
                                            className="flex-1 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingImage(true)}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} /> Add photo URL
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalonSettings;
