import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight, MapPin, Store, Armchair, Scissors, Plus, Trash2, Image as ImageIcon, Upload } from 'lucide-react';
import { mediaUrl } from '../../../utils/mediaUrl';

const SalonOnboarding = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        chairs: 1,
        services: [
            { name: 'Haircut', durationMin: 30, price: 200 },
            { name: 'Shave', durationMin: 15, price: 100 }
        ],
        images: [] as string[]
    });

    const [newService, setNewService] = useState({ name: '', durationMin: 30, price: 0 });
    const [newImage, setNewImage] = useState('');
    const [isAddingService, setIsAddingService] = useState(false);
    const [isAddingImage, setIsAddingImage] = useState(false);

    const createSalonMutation = useMutation({
        mutationFn: async (data: typeof formData & { files: File[] }) => {
            const { files, ...payload } = data;
            const res = await api.post('/salons', payload);
            const salonId = res.data?._id;
            if (salonId && files.length) {
                const body = new FormData();
                files.forEach((f) => body.append('images', f));
                await api.post(`/salons/${salonId}/images`, body);
            }
        },
        onSuccess: () => {
            toast.success('Salon created successfully!');
            window.location.reload();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to create salon');
        }
    });

    const handleSubmit = () => {
        if (!formData.name || !formData.address) {
            toast.error('Please fill in all required fields');
            return;
        }
        createSalonMutation.mutate({ ...formData, files: pendingFiles });
    };

    const handlePickFiles = (files: FileList | null) => {
        if (!files?.length) return;
        const next = Array.from(files).slice(0, 8);
        setPendingFiles((prev) => [...prev, ...next].slice(0, 8));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row border border-slate-100 dark:border-slate-700">

                {/* Left Side - Visual */}
                <div className="bg-slate-900 text-white p-8 md:w-1/3 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-primary/10"></div>
                    <div className="z-10">
                        <Scissors className="text-primary mb-4" size={32} />
                        <h2 className="text-2xl font-bold mb-2">Setup Your Salon</h2>
                        <p className="text-slate-400 text-sm">Let's get your business ready for smart bookings.</p>
                    </div>
                    <div className="z-10 flex gap-2 mt-8">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? 'bg-primary' : 'bg-slate-700'}`}></div>
                        ))}
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="p-8 md:w-2/3">
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Basic Details</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Tell us about your salon.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Salon Name</label>
                                    <div className="relative">
                                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-white"
                                            placeholder="e.g. The Royal Cut"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[100px] resize-none text-slate-900 dark:text-white"
                                            placeholder="Full address of your shop"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!formData.name || !formData.address}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next Step <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Capacity & Operations</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">How many customers can you serve?</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Number of Chairs / Barbers</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                        <Armchair size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={formData.chairs}
                                            onChange={(e) => setFormData({ ...formData, chairs: parseInt(e.target.value) })}
                                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <div className="flex justify-between mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                                            <span>1 Chair</span>
                                            <span className="text-primary font-bold text-lg">{formData.chairs} Chairs</span>
                                            <span>10 Chairs</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 text-sm text-yellow-800 dark:text-yellow-200">
                                <span className="font-bold">Note:</span> We've added default services. You can customize them in the next step.
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-[2] bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                >
                                    Next: Services <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Services Menu</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">customize your service offerings.</p>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                {formData.services.map((service, index) => (
                                    <div key={index} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700 group">
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-900 dark:text-white">{service.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{service.durationMin} mins • ₹{service.price}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newServices = [...formData.services];
                                                newServices.splice(index, 1);
                                                setFormData({ ...formData, services: newServices });
                                            }}
                                            className="text-red-400 hover:text-red-500 p-2 opacity-50 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
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
                                                        setFormData({
                                                            ...formData,
                                                            services: [...formData.services, newService]
                                                        });
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

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(4)}
                                    className="flex-[2] bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                >
                                    Next: Photos <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Salon Photos</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Add some photos to verify and showcase your salon.</p>
                            </div>

                            <div className="space-y-3">
                                {formData.images.map((img, index) => (
                                    <div key={`url-${index}`} className="flex gap-3 items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <img src={mediaUrl(img)} alt="Salon" className="w-16 h-16 rounded-lg object-cover bg-slate-200" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150')} />
                                        <div className="flex-1 truncate text-xs text-slate-500">{img}</div>
                                        <button
                                            onClick={() => {
                                                const newImages = [...formData.images];
                                                newImages.splice(index, 1);
                                                setFormData({ ...formData, images: newImages });
                                            }}
                                            className="text-red-400 hover:text-red-500 p-2"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}

                                {pendingFiles.map((file, index) => (
                                    <div key={`file-${file.name}-${index}`} className="flex gap-3 items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 rounded-lg object-cover bg-slate-200" />
                                        <div className="flex-1 truncate text-xs text-slate-500">{file.name}</div>
                                        <button
                                            onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                                            className="text-red-400 hover:text-red-500 p-2"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}

                                {formData.images.length === 0 && pendingFiles.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                                        <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                                        <p>No photos added yet</p>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handlePickFiles(e.target.files)}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload size={18} /> Upload from device
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
                                                        setFormData({
                                                            ...formData,
                                                            images: [...formData.images, newImage]
                                                        });
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
                                        <Plus size={18} /> Add Photo URL
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={createSalonMutation.isPending}
                                    className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    {createSalonMutation.isPending ? <Loader2 className="animate-spin" /> : 'Launch Dashboard'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalonOnboarding;
