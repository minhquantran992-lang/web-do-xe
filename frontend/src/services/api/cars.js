import { apiFetch } from './client.js';

export const getCars = async ({ metrics } = {}) => {
  const qs = metrics ? '?metrics=1' : '';
  try {
    const data = await apiFetch(`/api/cars${qs}`);
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((c) => ({
      ...c,
      name: c?.name || '',
      brand: c?.brand || '',
      category: c?.category || '',
      engineCc: Number.isFinite(c?.engineCc) ? c.engineCc : c?.engineCc ?? null,
      specs: c?.specs && typeof c.specs === 'object' ? c.specs : {},
      image: c?.image || '',
      model3d: c?.model3d || '',
      createdAt: c?.createdAt || '',
      modCount: Number.isFinite(c?.modCount) ? c.modCount : c?.modCount ?? 0
    }));
  } catch {
    return [
      {
        _id: 'xsro3',
        name: 'XSRO.3',
        brand: 'Yamaha',
        category: 'pkl',
        engineCc: 150,
        image: 'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=1600&auto=format&fit=crop',
        model3d: ''
      },
      {
        _id: 'cbr150',
        name: 'CBR150R',
        brand: 'Honda',
        category: 'sport',
        engineCc: 150,
        image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=1600&auto=format&fit=crop',
        model3d: ''
      },
      {
        _id: 'gsx150',
        name: 'GSX-150',
        brand: 'Suzuki',
        category: 'sport',
        engineCc: 150,
        image: 'https://images.unsplash.com/photo-1527240660655-79a275b06c83?q=80&w=1600&auto=format&fit=crop',
        model3d: ''
      }
    ];
  }
};

export const getBrands = async ({ vehicleType, type } = {}) => {
  const value = type ?? vehicleType;
  const qs = value ? `?vehicleType=${encodeURIComponent(value)}` : '';
  try {
    const data = await apiFetch(`/brands${qs}`);
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [
      { key: 'yamaha', name: 'Yamaha', logo: '' },
      { key: 'honda', name: 'Honda', logo: '' },
      { key: 'suzuki', name: 'Suzuki', logo: '' }
    ];
  }
};

export const getBackgrounds = async () => {
  try {
    const data = await apiFetch('/api/backgrounds');
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
};
